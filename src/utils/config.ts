import type { Config, ExpertItem, GridItem, ThemeMode } from '../types';
import { createDefaultConfig, generateId } from '../types';

interface StorageResult {
  config?: Config;
}

const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const DB_NAME = 'nk-quick-start-db';
const STORE_NAME = 'app-config';
const DB_VERSION = 1;
const CONFIG_KEY = 'config';
const CONFIG_SYNC_EVENT = 'nk-quick-start:config-updated';
const CONFIG_SYNC_CHANNEL = 'nk-quick-start-config';

interface ConfigRecord {
  key: typeof CONFIG_KEY;
  value: Config;
}

interface ConfigSyncMessage {
  type: 'config-updated';
  config: Config;
}

let dbPromise: Promise<IDBDatabase> | undefined;
let syncChannel: BroadcastChannel | null | undefined;

function getRuntimeError(): Error | undefined {
  const runtimeError = chrome.runtime?.lastError;
  if (!runtimeError) return undefined;
  return runtimeError instanceof Error ? runtimeError : new Error(runtimeError.message);
}

function storageGet<T>(keys: string | string[] | Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (result) => {
      const error = getRuntimeError();
      if (error) {
        reject(error);
        return;
      }
      resolve(result as T);
    });
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('打开 IndexedDB 失败'));
    });
  }

  return dbPromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 事务失败'));
    executor(store, resolve, reject);
  }));
}

function readConfigFromIndexedDb(): Promise<Config | undefined> {
  return withStore<Config | undefined>('readonly', (store, resolve, reject) => {
    const request = store.get(CONFIG_KEY);
    request.onsuccess = () => {
      const record = request.result as ConfigRecord | undefined;
      resolve(record?.value);
    };
    request.onerror = () => reject(request.error ?? new Error('读取 IndexedDB 配置失败'));
  });
}

function writeConfigToIndexedDb(config: Config): Promise<void> {
  return openDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({
      key: CONFIG_KEY,
      value: config
    } satisfies ConfigRecord);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('写入 IndexedDB 配置失败'));
    request.onerror = () => reject(request.error ?? new Error('写入 IndexedDB 配置失败'));
  }));
}

function getSyncChannel(): BroadcastChannel | null {
  if (syncChannel !== undefined) {
    return syncChannel;
  }

  syncChannel = typeof BroadcastChannel === 'function'
    ? new BroadcastChannel(CONFIG_SYNC_CHANNEL)
    : null;
  return syncChannel;
}

function notifyConfigChanged(config: Config) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<Config>(CONFIG_SYNC_EVENT, { detail: config }));
  }
  getSyncChannel()?.postMessage({
    type: 'config-updated',
    config
  } satisfies ConfigSyncMessage);
}

async function readLegacySyncConfig(): Promise<Config | undefined> {
  try {
    const result = await storageGet<StorageResult>(['config']);
    return result.config;
  } catch (error) {
    console.warn('读取旧版 chrome.storage.sync 配置失败，已跳过迁移:', error);
    return undefined;
  }
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

// 旧版本专家模式复用了九宫格数据，这里把旧结构平铺成新的 expertItems 结构。
function flattenGridToExpertItems(items: GridItem[], startIndex = 1): ExpertItem[] {
  const result: ExpertItem[] = [];
  let nextIndex = startIndex;

  items.forEach((item) => {
    if (item.type === 'url' && item.url) {
      result.push({
        id: item.id || generateId(),
        code: String(nextIndex),
        label: item.label || `网址${nextIndex}`,
        url: item.url
      });
      nextIndex += 1;
    } else if (item.type === 'grid' && item.grid) {
      const childItems = flattenGridToExpertItems(item.grid, nextIndex);
      result.push(...childItems);
      nextIndex += childItems.length;
    }
  });

  return result;
}

// 统一在读取和写入时做一次配置归一化，避免旧配置或缺字段配置把界面打坏。
function normalizeConfig(config: Config): Config {
  const defaults = createDefaultConfig();
  const normalizedExpertItems = (config.expertItems?.length ? config.expertItems : flattenGridToExpertItems(config.items ?? defaults.items))
    .map((item, index) => ({
      id: item.id || generateId(),
      code: String(item.code || index + 1).trim(),
      label: item.label || `网址${index + 1}`,
      url: item.url || ''
    }))
    .filter(item => item.code);

  return {
    ...defaults,
    ...config,
    themeMode: isThemeMode(config.themeMode) ? config.themeMode : defaults.themeMode,
    customCss: config.customCss || defaults.customCss,
    searchEngines: config.searchEngines?.length ? config.searchEngines : defaults.searchEngines,
    defaultSearchEngineId: config.defaultSearchEngineId || defaults.defaultSearchEngineId,
    items: config.items?.length ? config.items : defaults.items,
    expertItems: normalizedExpertItems.length ? normalizedExpertItems : defaults.expertItems
  };
}

export async function ensureConfig(): Promise<Config> {
  const indexedDbConfig = await readConfigFromIndexedDb();
  if (indexedDbConfig) {
    const normalizedConfig = normalizeConfig(indexedDbConfig);
    // 如果读到的是旧结构或缺省字段，顺手回写一次，后续页面都走统一结构。
    if (JSON.stringify(normalizedConfig) !== JSON.stringify(indexedDbConfig)) {
      await writeConfigToIndexedDb(normalizedConfig);
      notifyConfigChanged(normalizedConfig);
    }
    return normalizedConfig;
  }

  const legacyConfig = await readLegacySyncConfig();
  if (legacyConfig) {
    const normalizedConfig = normalizeConfig(legacyConfig);
    await writeConfigToIndexedDb(normalizedConfig);
    notifyConfigChanged(normalizedConfig);
    return normalizedConfig;
  }

  // 首次安装时补一份默认配置，保证所有入口行为一致。
  const defaultConfig = createDefaultConfig();
  await writeConfigToIndexedDb(defaultConfig);
  notifyConfigChanged(defaultConfig);
  return defaultConfig;
}

export async function saveConfig(config: Config): Promise<void> {
  const normalizedConfig = normalizeConfig(config);
  await writeConfigToIndexedDb(normalizedConfig);
  notifyConfigChanged(normalizedConfig);
}

export function subscribeConfigChanges(onChange: (config: Config) => void): () => void {
  const handleWindowChange = (event: Event) => {
    const customEvent = event as CustomEvent<Config>;
    if (customEvent.detail) {
      onChange(customEvent.detail);
    }
  };

  const handleChannelMessage = (event: MessageEvent<ConfigSyncMessage>) => {
    if (event.data?.type === 'config-updated') {
      onChange(event.data.config);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(CONFIG_SYNC_EVENT, handleWindowChange as EventListener);
  }

  const channel = getSyncChannel();
  channel?.addEventListener('message', handleChannelMessage as EventListener);

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(CONFIG_SYNC_EVENT, handleWindowChange as EventListener);
    }
    channel?.removeEventListener('message', handleChannelMessage as EventListener);
  };
}

function resolveThemeMode(themeMode: ThemeMode): 'light' | 'dark' {
  if (themeMode === 'system') {
    return window.matchMedia(THEME_MEDIA_QUERY).matches ? 'dark' : 'light';
  }
  return themeMode;
}

export function applyThemeMode(themeMode: ThemeMode) {
  const root = document.documentElement;
  const resolvedMode = resolveThemeMode(themeMode);
  root.dataset.theme = resolvedMode;
  root.dataset.themePreference = themeMode;
}

export function applyCustomCss(customCss?: Config['customCss']) {
  const root = document.documentElement;
  if (customCss?.brandColor) {
    root.style.setProperty('--c-theme', customCss.brandColor);
    root.style.setProperty('--c-theme-hover', customCss.brandColor + 'cc');
  } else {
    root.style.removeProperty('--c-theme');
    root.style.removeProperty('--c-theme-hover');
  }
  
  if (customCss?.borderRadius) {
    root.style.setProperty('--radius-base', customCss.borderRadius);
  } else {
    root.style.removeProperty('--radius-base');
  }
}

export function watchSystemTheme(themeMode: ThemeMode, onChange?: () => void) {
  const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);
  const listener = () => {
    // 只有“跟随系统”模式需要响应系统主题变化，固定主题时直接忽略。
    if (document.documentElement.dataset.themePreference === 'system') {
      applyThemeMode(themeMode);
      onChange?.();
    }
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }

  mediaQuery.addListener(listener);
  return () => mediaQuery.removeListener(listener);
}
