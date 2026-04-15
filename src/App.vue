<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { Config } from './types';
import { createDefaultConfig } from './types';
import PopupView from './components/PopupView.vue';
import { applyThemeMode, ensureConfig, watchSystemTheme } from './utils/config';

const config = ref<Config>(createDefaultConfig());
const loading = ref(true);
let stopWatchingSystemTheme: (() => void) | undefined;

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
