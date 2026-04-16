<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type { Config, ExpertItem } from './types';
import { applyThemeMode, applyCustomCss, ensureConfig, subscribeConfigChanges, watchSystemTheme } from './utils/config';

const config = ref<Config | null>(null);
const searchQuery = ref('');
const matchedItems = ref<ExpertItem[]>([]);
const inputRef = ref<HTMLInputElement | null>(null);
let stopWatchingSystemTheme: (() => void) | undefined;
let removeConfigListener: (() => void) | undefined;

async function loadConfig() {
  try {
    config.value = await ensureConfig();
  } catch (e) {
    console.error('加载配置失败:', e);
  }
}

const allItems = computed(() => {
  if (!config.value) return [];
  return config.value.expertItems.filter(item => item.url);
});

function search() {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    matchedItems.value = [];
    return;
  }

  // 匹配逻辑：编号精确匹配，名称模糊匹配
  matchedItems.value = allItems.value.filter(m => {
    if (m.code.toLowerCase() === query) {
      return true;
    }
    return m.label.toLowerCase().includes(query);
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
    jumpToUrl(matchedItems.value[0].url || '');
  } else if (e.key === 'Escape') {
    window.close();
  }
}

onMounted(() => {
  loadConfig();
  inputRef.value?.focus();
  removeConfigListener = subscribeConfigChanges((newConfig) => {
    config.value = newConfig;
    search();
  });
});

onUnmounted(() => {
  removeConfigListener?.();
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

watch(
  () => config.value?.customCss,
  (customCss) => {
    applyCustomCss(customCss);
  },
  { immediate: true, deep: true }
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
          placeholder="输入自定义编号或名称后回车跳转"
          class="form-input px-5 py-4 text-lg shadow-lg"
        />
      </div>

      <!-- 匹配结果 -->
      <div v-if="matchedItems.length > 0" class="space-y-2">
        <div
          v-for="(match, idx) in matchedItems"
          :key="idx"
          @click="jumpToUrl(match.url || '')"
          class="search-result flex cursor-pointer items-center gap-4 p-4 transition-all duration-200"
        >
          <div class="badge h-10 w-10 font-bold">
            {{ match.code }}
          </div>
          <div class="flex-1">
            <div class="text-theme font-medium">{{ match.label }}</div>
            <div class="text-muted text-xs">{{ match.url }}</div>
          </div>
        </div>
      </div>

      <!-- 提示 -->
      <div v-else-if="searchQuery" class="text-muted text-center">
        未找到匹配的网址
      </div>

      <!-- 使用说明 -->
      <div v-else class="text-muted text-center text-sm">
        <p>输入自定义编号或名称快速跳转</p>
        <p class="mt-2">按 ESC 关闭</p>
      </div>
    </div>
  </div>
</template>
