<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type { Config, GridItem } from './types';
import { applyThemeMode, ensureConfig, watchSystemTheme } from './utils/config';

const config = ref<Config | null>(null);
const searchQuery = ref('');
const matchedItems = ref<Array<{ item: GridItem; path: string[]; index: number }>>([]);
const inputRef = ref<HTMLInputElement | null>(null);
let stopWatchingSystemTheme: (() => void) | undefined;

interface MatchedItem {
  item: GridItem;
  path: string[];
  index: number;
}

async function loadConfig() {
  try {
    config.value = await ensureConfig();
  } catch (e) {
    console.error('加载配置失败:', e);
  }
}

function flattenGrid(items: GridItem[], path: string[] = [], startIndex = 1): MatchedItem[] {
  const result: MatchedItem[] = [];
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
      // 递归时把当前累计编号传下去，保证整棵树的编号连续且唯一。
      const childItems = flattenGrid(item.grid, currentPath, nextIndex);
      result.push(...childItems);
      nextIndex += childItems.length;
    }
  });
  return result;
}

const allItems = computed(() => {
  if (!config.value) return [];
  return flattenGrid(config.value.items);
});

function search() {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    matchedItems.value = [];
    return;
  }

  // 匹配逻辑：编号精确匹配，名称模糊匹配
  matchedItems.value = allItems.value.filter(m => {
    // 尝试匹配编号
    if (/^\d+$/.test(query)) {
      return m.index === parseInt(query);
    }
    // 尝试匹配名称（模糊匹配）
    return m.item.label.toLowerCase().includes(query);
  }).slice(0, 9); // 最多显示9个结果
}

function jumpToUrl(url: string) {
  if (url) {
    chrome.tabs.create({ url });
    window.close();
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && matchedItems.value.length > 0) {
    jumpToUrl(matchedItems.value[0].item.url || '');
  } else if (e.key === 'Escape') {
    window.close();
  }
}

onMounted(() => {
  loadConfig();
  inputRef.value?.focus();
});

watch(
  () => config.value?.themeMode,
  (themeMode) => {
    if (!themeMode) return;
    applyThemeMode(themeMode);
    stopWatchingSystemTheme?.();
    stopWatchingSystemTheme = watchSystemTheme(themeMode);
  },
  { immediate: true }
);
</script>

<template>
  <div class="page-shell flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- 搜索框 -->
      <div class="mb-6">
        <input
          ref="inputRef"
          v-model="searchQuery"
          @input="search"
          @keydown="handleKeydown"
          type="text"
          placeholder="输入编号(1-9)或名称(可模糊)后回车跳转"
          class="form-input px-5 py-4 text-lg shadow-lg"
        />
      </div>

      <!-- 匹配结果 -->
      <div v-if="matchedItems.length > 0" class="space-y-2">
        <div
          v-for="(match, idx) in matchedItems"
          :key="idx"
          @click="jumpToUrl(match.item.url || '')"
          class="search-result flex cursor-pointer items-center gap-4 p-4 transition-all duration-200"
        >
          <div class="badge h-10 w-10 font-bold">
            {{ match.index }}
          </div>
          <div class="flex-1">
            <div class="text-theme font-medium">{{ match.item.label }}</div>
            <div class="text-muted text-xs">{{ match.path.join(' > ') }}</div>
          </div>
        </div>
      </div>

      <!-- 提示 -->
      <div v-else-if="searchQuery" class="text-muted text-center">
        未找到匹配的网址
      </div>

      <!-- 使用说明 -->
      <div v-else class="text-muted text-center text-sm">
        <p>输入编号或名称快速跳转</p>
        <p class="mt-2">按 ESC 关闭</p>
      </div>
    </div>
  </div>
</template>
