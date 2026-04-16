<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Config, ExpertItem, GridItem, ThemeMode, SearchEngine } from '../types';
import GridView from './GridView.vue';
import { applyThemeMode, saveConfig } from '../utils/config';

const props = defineProps<{
  config: Config;
}>();

const popupConfig = ref<Config>(JSON.parse(JSON.stringify(props.config)));
const currentPath = ref<number[]>([]);
const searchQuery = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

interface SearchResultItem {
  id: string;
  label: string;
  url: string;
  code: string;
  path: string[];
}

interface PopupCommand {
  id: string;
  label: string;
  aliases: string[];
  description: string;
  run: () => Promise<void> | void;
}

const themeModeLabels: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统'
};

watch(() => props.config, (newConfig) => {
  popupConfig.value = JSON.parse(JSON.stringify(newConfig));
  currentPath.value = [];
}, { deep: true });

onMounted(() => {
  inputRef.value?.focus();
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});

function resolveGridAtPath(items: GridItem[], path: number[]): GridItem[] {
  let current = items;
  for (const idx of path) {
    const target = current[idx];
    if (target?.type === 'grid' && target.grid) {
      current = target.grid;
    } else {
      return items;
    }
  }
  return current;
}

const breadcrumbs = computed(() => {
  const paths: string[] = [];
  let current = popupConfig.value.items;
  for (const idx of activePath.value) {
    paths.push(current[idx].label);
    if (current[idx].type === 'grid' && current[idx].grid) {
      current = current[idx].grid;
    }
  }
  return paths;
});

const currentGrid = computed(() => resolveGridAtPath(popupConfig.value.items, activePath.value));

function flattenGrid(items: GridItem[], path: string[] = [], codePath: number[] = []): SearchResultItem[] {
  const result: SearchResultItem[] = [];

  items.forEach((item, index) => {
    const currentPath = [...path, item.label || `网站${index + 1}`];
    const currentCodePath = [...codePath, index + 1];
    if (item.type === 'url' && item.url) {
      result.push({
        id: item.id,
        label: item.label || `网站${currentCodePath.join('')}`,
        url: item.url,
        code: currentCodePath.join(''),
        path: currentPath,
      });
    } else if (item.type === 'grid' && item.grid) {
      const childItems = flattenGrid(item.grid, currentPath, currentCodePath);
      result.push(...childItems);
    }
  });

  return result;
}

function flattenExpertItems(items: ExpertItem[]): SearchResultItem[] {
  return items
    .filter(item => item.url)
    .map(item => ({
      id: item.id,
      label: item.label,
      url: item.url,
      code: item.code,
      path: [item.label]
    }));
}

// simple 模式搜索九宫格链路，expert 模式搜索独立扁平列表，两种模式共用同一套展示逻辑。
const allItems = computed(() =>
  popupConfig.value.mode === 'expert'
    ? flattenExpertItems(popupConfig.value.expertItems)
    : flattenGrid(popupConfig.value.items)
);

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());
const isCommandQuery = computed(() => normalizedQuery.value.startsWith('/'));
const commandKeyword = computed(() => normalizedQuery.value.slice(1));
const hasSearchInput = computed(() => normalizedQuery.value.length > 0);
const digitQuery = computed(() => /^\d+$/.test(normalizedQuery.value) ? normalizedQuery.value : '');

function resolveGridPathFromCode(items: GridItem[], code: string): number[] | null {
  if (!code) return null;

  let current = items;
  const resolvedPath: number[] = [];

  for (const char of code) {
    const gridIndex = Number(char) - 1;
    const target = current[gridIndex];
    if (!target || target.type !== 'grid' || !target.grid) {
      return null;
    }
    resolvedPath.push(gridIndex);
    current = target.grid;
  }

  return resolvedPath;
}

const queryDrivenPath = computed(() =>
  popupConfig.value.mode === 'simple'
    ? resolveGridPathFromCode(popupConfig.value.items, digitQuery.value)
    : null
);

const activePath = computed(() => queryDrivenPath.value ?? currentPath.value);

function handleItemClick(item: GridItem, index: number) {
  if (item.type === 'url' && item.url) {
    chrome.tabs.create({ url: item.url });
    window.close();
  } else if (item.type === 'grid' && item.grid) {
    // 进入子网格
    currentPath.value.push(index);
  }
}

function goBack() {
  if (popupConfig.value.mode !== 'simple') return;

  if (queryDrivenPath.value && digitQuery.value) {
    searchQuery.value = digitQuery.value.slice(0, -1);
    return;
  }

  if (currentPath.value.length === 0) return;
  currentPath.value.pop();
}

function goHome() {
  searchQuery.value = '';
  currentPath.value = [];
}

function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  window.close();
}

function openAbout() {
  chrome.tabs.create({ url: chrome.runtime.getURL('about.html') });
  window.close();
}

async function setThemeMode(themeMode: ThemeMode) {
  popupConfig.value.themeMode = themeMode;
  applyThemeMode(themeMode);
  await saveConfig(popupConfig.value);
}

const currentThemeLabel = computed(() => themeModeLabels[popupConfig.value.themeMode]);

async function cycleThemeMode() {
  const themeModes: ThemeMode[] = ['light', 'dark', 'system'];
  const currentIndex = themeModes.indexOf(popupConfig.value.themeMode);
  const nextThemeMode = themeModes[(currentIndex + 1) % themeModes.length];
  await setThemeMode(nextThemeMode);
}

const popupCommands = computed<PopupCommand[]>(() => [
  {
    id: 'dark',
    label: '/Dark',
    aliases: ['d', 'dark'],
    description: '切换到 Dark 模式',
    run: () => setThemeMode('dark')
  },
  {
    id: 'light',
    label: '/Light',
    aliases: ['l', 'light'],
    description: '切换到 Light 模式',
    run: () => setThemeMode('light')
  },
  {
    id: 'system',
    label: '/Whatever',
    aliases: ['w', 'whatever'],
    description: '切换到跟随系统',
    run: () => setThemeMode('system')
  },
  {
    id: 'settings',
    label: '/Settings',
    aliases: ['s', 'settings'],
    description: '打开设置页面',
    run: openSettings
  },
  {
    id: 'about',
    label: '/About',
    aliases: ['a', 'about'],
    description: '打开关于页面',
    run: openAbout
  }
]);

const matchedCommands = computed(() => {
  if (!isCommandQuery.value) return [];
  if (!commandKeyword.value) return popupCommands.value;
  return popupCommands.value.filter(command =>
    command.aliases.some(alias => alias.startsWith(commandKeyword.value))
  );
});

// Handle search engine queries
const searchEngineMatch = computed<{ engine: SearchEngine; query: string } | null>(() => {
  if (isCommandQuery.value) return null;
  const rawQuery = searchQuery.value.trim();
  if (!rawQuery) return null;

  const parts = rawQuery.split(' ');
  if (parts.length >= 2) {
    const prefix = parts[0].toLowerCase();
    const engine = popupConfig.value.searchEngines.find(e => e.prefix.toLowerCase() === prefix);
    if (engine) {
      return { engine, query: parts.slice(1).join(' ') };
    }
  }

  // Use default engine if available
  if (popupConfig.value.defaultSearchEngineId) {
    const defaultEngine = popupConfig.value.searchEngines.find(e => e.id === popupConfig.value.defaultSearchEngineId);
    if (defaultEngine) {
      return { engine: defaultEngine, query: rawQuery };
    }
  }

  return null;
});

const matchedItems = computed(() => {
  if (isCommandQuery.value || !normalizedQuery.value) return [];
  if (popupConfig.value.mode === 'simple' && queryDrivenPath.value) return [];
  return allItems.value
    .filter(match => {
      if (match.code.toLowerCase() === normalizedQuery.value) {
        return true;
      }
      return match.label.toLowerCase().includes(normalizedQuery.value);
    })
    .sort((a, b) => {
      const aExactCode = a.code.toLowerCase() === normalizedQuery.value ? 1 : 0;
      const bExactCode = b.code.toLowerCase() === normalizedQuery.value ? 1 : 0;
      if (aExactCode !== bExactCode) {
        return bExactCode - aExactCode;
      }

      // 同等匹配级别下优先展示更浅层、更短的编号，避免子网格名称匹配抢在主格结果前面。
      if (a.code.length !== b.code.length) {
        return a.code.length - b.code.length;
      }

      return a.code.localeCompare(b.code, 'zh-CN');
    })
    .slice(0, 9);
});

async function executeCommand(command: PopupCommand) {
  await command.run();
  // 主题切换命令执行后清空输入，方便用户立刻看到模式变化。
  if (command.id === 'dark' || command.id === 'light' || command.id === 'system') {
    searchQuery.value = '';
  }
}

function jumpToUrl(url: string) {
  if (!url) return;
  chrome.tabs.create({ url });
  window.close();
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' && popupConfig.value.mode === 'simple' && activePath.value.length > 0) {
    e.preventDefault();
    goBack();
  }
}

async function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    if (isCommandQuery.value && matchedCommands.value.length > 0) {
      await executeCommand(matchedCommands.value[0]);
      return;
    }
    if (matchedItems.value.length > 0) {
      jumpToUrl(matchedItems.value[0].url || '');
      return;
    }
    if (searchEngineMatch.value) {
      const { engine, query } = searchEngineMatch.value;
      jumpToUrl(engine.url.replace('%s', encodeURIComponent(query)));
      return;
    }
    return;
  }

  if (e.key === 'Escape') {
    if (searchQuery.value.trim()) {
      searchQuery.value = '';
      return;
    }
    window.close();
  }
}
</script>

<template>
  <div class="popup-shell page-shell flex flex-col p-4">
    <div class="mb-4">
      <input
        ref="inputRef"
        v-model="searchQuery"
        @keydown="handleKeydown"
        type="text"
        placeholder="搜索网址，或输入 /D /L /W /S /A"
        class="form-input px-4 py-3 text-sm shadow-lg"
      />
    </div>

    <div
      v-if="popupConfig.mode === 'simple' && activePath.length > 0"
      class="mb-3 flex items-center justify-between gap-3"
    >
      <div class="text-muted text-xs">按【方向左】返回上一层级</div>
      <button
        type="button"
        @click="goBack"
        class="toolbar-button px-3 py-1.5 text-xs"
      >
        ←返回
      </button>
    </div>

    <!-- 面包屑导航 -->
    <div v-if="popupConfig.mode === 'simple' && activePath.length > 0" class="mb-4 flex items-center">
      <button
        @click="goHome"
        class="text-secondary flex items-center gap-1 text-sm transition-colors hover:opacity-80"
      >
        <span class="i-carbon-home text-lg"></span>
        <span>首页</span>
      </button>
      <template v-for="(crumb, idx) in breadcrumbs" :key="idx">
        <span class="text-muted mx-2">/</span>
        <span class="text-muted text-sm">{{ crumb }}</span>
      </template>
      <template v-if="activePath.length > 0">
        <span class="text-muted mx-2">/</span>
        <button @click="goBack" class="text-secondary text-sm hover:opacity-80">
          返回
        </button>
      </template>
    </div>

    <div v-if="isCommandQuery && hasSearchInput" class="space-y-2">
      <button
        v-for="command in matchedCommands"
        :key="command.id"
        type="button"
        @click="executeCommand(command)"
        class="search-result flex w-full items-center justify-between gap-3 p-3 text-left transition-all duration-200"
      >
        <span>
          <span class="text-theme block text-sm font-semibold">{{ command.label }}</span>
          <span class="text-muted mt-1 block text-xs">{{ command.description }}</span>
        </span>
        <span class="badge px-3 py-1 text-xs">{{ command.aliases[0].toUpperCase() }}</span>
      </button>
      <div v-if="matchedCommands.length === 0" class="text-muted px-1 text-sm">
        未找到命令，可用命令：`/D` `/L` `/W` `/S` `/A`
      </div>
    </div>

    <div v-else-if="matchedItems.length > 0" class="space-y-2">
      <button
        v-for="match in matchedItems"
        :key="`${match.code}-${match.id}`"
        type="button"
        @click="jumpToUrl(match.url || '')"
        class="search-result flex w-full items-center gap-3 p-3 text-left transition-all duration-200"
      >
        <div class="badge h-9 w-9 shrink-0 text-sm font-semibold">
          {{ match.code }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-theme truncate text-sm font-medium">{{ match.label }}</div>
          <div class="text-muted truncate text-xs">{{ match.path.join(' > ') }}</div>
        </div>
      </button>
    </div>

    <div v-else-if="searchEngineMatch" class="space-y-2">
      <button
        type="button"
        @click="jumpToUrl(searchEngineMatch.engine.url.replace('%s', encodeURIComponent(searchEngineMatch.query)))"
        class="search-result flex w-full items-center gap-3 p-3 text-left transition-all duration-200"
      >
        <div class="badge h-9 w-9 shrink-0 text-sm font-semibold flex items-center justify-center">
          <span class="i-carbon-search text-lg"></span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-theme truncate text-sm font-medium">使用 {{ searchEngineMatch.engine.name }} 搜索</div>
          <div class="text-muted truncate text-xs">{{ searchEngineMatch.query }}</div>
        </div>
      </button>
    </div>

    <div
      v-else-if="hasSearchInput && !(popupConfig.mode === 'simple' && queryDrivenPath)"
      class="text-muted px-1 text-sm"
    >
      未找到匹配项。可继续输入网址名称 / 编号，或试试 `/D` `/L` `/W` `/S` `/A`。
    </div>

    <!-- 九宫格 -->
    <div
      v-if="popupConfig.mode === 'simple' && (!hasSearchInput || queryDrivenPath)"
      class="flex-1 flex items-center justify-center"
    >
      <GridView
        :items="currentGrid"
        @item-click="handleItemClick"
      />
    </div>

    <div v-else-if="popupConfig.mode === 'expert'" class="flex-1"></div>

    <div v-if="popupConfig.mode === 'simple'" class="mt-4 grid grid-cols-3 gap-3">
      <button
        @click="openSettings"
        class="toolbar-button flex items-center justify-center gap-2 px-3 py-2"
      >
        <span class="i-carbon-settings text-base"></span>
        <span class="text-sm">设置</span>
      </button>
      <button
        @click="openAbout"
        class="toolbar-button flex items-center justify-center gap-2 px-3 py-2"
      >
        <span class="i-carbon-information text-base"></span>
        <span class="text-sm">关于</span>
      </button>
      <button
        @click="cycleThemeMode"
        class="toolbar-button flex items-center justify-center gap-2 px-3 py-2"
      >
        <span class="i-carbon-contrast text-base"></span>
        <span class="text-sm">{{ currentThemeLabel }}</span>
      </button>
    </div>
  </div>
</template>
