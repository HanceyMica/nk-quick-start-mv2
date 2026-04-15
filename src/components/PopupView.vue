<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { Config, GridItem, ThemeMode } from '../types';
import GridView from './GridView.vue';
import { applyThemeMode, saveConfig } from '../utils/config';

const props = defineProps<{
  config: Config;
}>();

const popupConfig = ref<Config>(JSON.parse(JSON.stringify(props.config)));
const currentGrid = ref<GridItem[]>(props.config.items);
const currentPath = ref<number[]>([]);
const isSubGrid = ref(false);
const searchQuery = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

interface SearchResultItem {
  item: GridItem;
  path: string[];
  index: number;
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
  if (newConfig.mode === 'simple') {
    currentGrid.value = newConfig.items;
    currentPath.value = [];
    isSubGrid.value = false;
  }
}, { deep: true });

onMounted(() => {
  inputRef.value?.focus();
});

const breadcrumbs = computed(() => {
  const paths: string[] = [];
  let current = popupConfig.value.items;
  for (const idx of currentPath.value) {
    paths.push(current[idx].label);
    if (current[idx].type === 'grid' && current[idx].grid) {
      current = current[idx].grid;
    }
  }
  return paths;
});

function flattenGrid(items: GridItem[], path: string[] = [], startIndex = 1): SearchResultItem[] {
  const result: SearchResultItem[] = [];
  let nextIndex = startIndex;

  items.forEach((item, index) => {
    const currentPath = [...path, item.label || `网站${index + 1}`];
    if (item.type === 'url' && item.url) {
      result.push({
        item,
        path: currentPath,
        index: nextIndex
      });
      nextIndex += 1;
    } else if (item.type === 'grid' && item.grid) {
      const childItems = flattenGrid(item.grid, currentPath, nextIndex);
      result.push(...childItems);
      nextIndex += childItems.length;
    }
  });

  return result;
}

const allItems = computed(() => flattenGrid(popupConfig.value.items));

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());
const isCommandQuery = computed(() => normalizedQuery.value.startsWith('/'));
const commandKeyword = computed(() => normalizedQuery.value.slice(1));
const hasSearchInput = computed(() => normalizedQuery.value.length > 0);

function handleItemClick(item: GridItem, index: number) {
  if (item.type === 'url' && item.url) {
    chrome.tabs.create({ url: item.url });
    window.close();
  } else if (item.type === 'grid' && item.grid) {
    // 进入子网格
    currentPath.value.push(index);
    currentGrid.value = item.grid;
    isSubGrid.value = true;
  }
}

function goBack() {
  if (currentPath.value.length === 0) return;

  currentPath.value.pop();

  if (currentPath.value.length === 0) {
    currentGrid.value = popupConfig.value.items;
    isSubGrid.value = false;
  } else {
    // 重新计算当前网格
    let current = popupConfig.value.items;
    for (const idx of currentPath.value) {
      if (current[idx].type === 'grid' && current[idx].grid) {
        current = current[idx].grid;
      }
    }
    currentGrid.value = current;
  }
}

function goHome() {
  currentPath.value = [];
  currentGrid.value = popupConfig.value.items;
  isSubGrid.value = false;
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

const matchedItems = computed(() => {
  if (isCommandQuery.value || !normalizedQuery.value) return [];
  return allItems.value.filter(match => {
    if (/^\d+$/.test(normalizedQuery.value)) {
      return match.index === Number(normalizedQuery.value);
    }
    return match.item.label.toLowerCase().includes(normalizedQuery.value);
  }).slice(0, 9);
});

async function executeCommand(command: PopupCommand) {
  await command.run();
  if (command.id === 'dark' || command.id === 'light' || command.id === 'system') {
    searchQuery.value = '';
  }
}

function jumpToUrl(url: string) {
  if (!url) return;
  chrome.tabs.create({ url });
  window.close();
}

async function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    if (isCommandQuery.value && matchedCommands.value.length > 0) {
      await executeCommand(matchedCommands.value[0]);
      return;
    }
    if (matchedItems.value.length > 0) {
      jumpToUrl(matchedItems.value[0].item.url || '');
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

    <!-- 面包屑导航 -->
    <div v-if="popupConfig.mode === 'simple' && !searchQuery && isSubGrid" class="mb-4 flex items-center">
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
      <template v-if="currentPath.length > 0">
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
        :key="`${match.index}-${match.item.id}`"
        type="button"
        @click="jumpToUrl(match.item.url || '')"
        class="search-result flex w-full items-center gap-3 p-3 text-left transition-all duration-200"
      >
        <div class="badge h-9 w-9 shrink-0 text-sm font-semibold">
          {{ match.index }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-theme truncate text-sm font-medium">{{ match.item.label }}</div>
          <div class="text-muted truncate text-xs">{{ match.path.join(' > ') }}</div>
        </div>
      </button>
    </div>

    <div v-else-if="hasSearchInput" class="text-muted px-1 text-sm">
      未找到匹配项。可继续输入网址名称 / 编号，或试试 `/D` `/L` `/W` `/S` `/A`。
    </div>

    <!-- 九宫格 -->
    <div
      v-if="popupConfig.mode === 'simple' && !hasSearchInput"
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
