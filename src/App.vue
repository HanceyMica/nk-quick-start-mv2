<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import type { Config } from './types';
import { createDefaultConfig } from './types';
import PopupView from './components/PopupView.vue';
import { applyThemeMode, ensureConfig, watchSystemTheme } from './utils/config';

const config = ref<Config>(createDefaultConfig());
const loading = ref(true);
let stopWatchingSystemTheme: (() => void) | undefined;
let removeStorageListener: (() => void) | undefined;

async function loadConfig() {
  try {
    config.value = await ensureConfig();
  } catch (e) {
    console.error('加载配置失败:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadConfig();

  // popup 可能在设置页保存后仍处于打开状态，这里直接监听 storage 变化同步最新配置。
  const handleStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName === 'sync' && changes.config?.newValue) {
      config.value = changes.config.newValue as Config;
    }
  };

  chrome.storage.onChanged.addListener(handleStorageChanged);
  removeStorageListener = () => chrome.storage.onChanged.removeListener(handleStorageChanged);
});

onUnmounted(() => {
  removeStorageListener?.();
});

watch(
  () => config.value.themeMode,
  (themeMode) => {
    applyThemeMode(themeMode);
    stopWatchingSystemTheme?.();
    stopWatchingSystemTheme = watchSystemTheme(themeMode);
  },
  { immediate: true }
);
</script>

<template>
  <div class="popup-root page-shell overflow-hidden">
    <PopupView v-if="!loading" :config="config" />
    <div v-else class="popup-shell flex items-center justify-center">
      <div class="text-muted i-carbon-circle-dash animate-spin text-4xl"></div>
    </div>
  </div>
</template>
