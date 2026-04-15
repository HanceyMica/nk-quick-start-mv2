import type { Config, ExpertItem, GridItem, ThemeMode } from '../types';
import { createDefaultConfig, generateId } from '../types';

interface StorageResult {
  config?: Config;
}

const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

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
    items: config.items?.length ? config.items : defaults.items,
    expertItems: normalizedExpertItems.length ? normalizedExpertItems : defaults.expertItems
  };
}

export async function ensureConfig(): Promise<Config> {
  const result = await chrome.storage.sync.get(['config']) as StorageResult;
  if (result.config) {
    const normalizedConfig = normalizeConfig(result.config);
    if (JSON.stringify(normalizedConfig) !== JSON.stringify(result.config)) {
      await chrome.storage.sync.set({ config: normalizedConfig });
    }
    return normalizedConfig;
  }

  // 首次安装时补一份默认配置，保证所有入口行为一致。
  const defaultConfig = createDefaultConfig();
  await chrome.storage.sync.set({ config: defaultConfig });
  return defaultConfig;
}

export async function saveConfig(config: Config): Promise<void> {
  await chrome.storage.sync.set({ config: normalizeConfig(config) });
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

export function watchSystemTheme(themeMode: ThemeMode, onChange?: () => void) {
  const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);
  const listener = () => {
    if (document.documentElement.dataset.themePreference === 'system') {
      applyThemeMode(themeMode);
      onChange?.();
    }
  };

  mediaQuery.addEventListener('change', listener);
  return () => mediaQuery.removeEventListener('change', listener);
}
