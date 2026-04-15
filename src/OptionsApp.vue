<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { Config } from './types';
import { createDefaultConfig } from './types';
import SettingsForm from './components/SettingsForm.vue';
import { applyThemeMode, ensureConfig, saveConfig, watchSystemTheme } from './utils/config';

const config = ref<Config>(createDefaultConfig());
const loading = ref(true);
const showToast = ref(false);
const toastMessage = ref('');
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

async function handleSave(newConfig: Config) {
  try {
    await saveConfig(newConfig);
    config.value = newConfig;
    showToastMessage('保存成功');
  } catch (e) {
    console.error('保存失败:', e);
    showToastMessage('保存失败', false);
  }
}

function showToastMessage(message: string, _success = true) {
  toastMessage.value = message;
  showToast.value = true;
  setTimeout(() => {
    showToast.value = false;
  }, 3000);
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
  <div class="page-shell py-8 px-4">
    <div class="max-w-3xl mx-auto">
      <h1 class="text-theme mb-3 text-center text-3xl font-bold">九宫格网址配置</h1>
      <p class="text-muted mb-8 text-center text-sm">管理九宫格网站、子网格和主题显示模式。</p>

      <SettingsForm
        v-if="!loading"
        :config="config"
        @save="handleSave"
      />

      <!-- Toast提示 -->
      <div
        v-if="showToast"
        class="toast-panel fade-in fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl px-6 py-3 shadow-lg"
        :class="toastMessage.includes('失败') ? 'text-rose-600' : 'text-emerald-600'"
      >
        {{ toastMessage }}
      </div>
    </div>
  </div>
</template>
