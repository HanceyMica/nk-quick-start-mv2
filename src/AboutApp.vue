<script setup lang="ts">
import { onMounted } from 'vue';
import { applyThemeMode, ensureConfig, watchSystemTheme } from './utils/config';

let stopWatchingSystemTheme: (() => void) | undefined;

onMounted(async () => {
  try {
    const config = await ensureConfig();
    applyThemeMode(config.themeMode);
    stopWatchingSystemTheme?.();
    stopWatchingSystemTheme = watchSystemTheme(config.themeMode);
  } catch (e) {
    console.error('加载主题配置失败:', e);
    applyThemeMode('light');
  }
});
</script>

<template>
  <div class="page-shell flex items-center justify-center p-4">
    <div class="panel max-w-md w-full p-8">
      <h1 class="text-theme mb-6 text-center text-3xl font-bold">九宫格网址跳转</h1>

      <div class="space-y-4 text-secondary">
        <p>这是一个便捷的Chrome扩展，提供九宫格形式的网址快速跳转功能。</p>

        <div class="panel-muted p-4">
          <h2 class="text-theme mb-2 font-semibold">功能特点：</h2>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>简洁直观的九宫格界面</li>
            <li>支持网格套娃（子网格）功能</li>
            <li>专家模式：快捷键快速跳转</li>
            <li>可自定义九个网址快捷方式</li>
            <li>支持导入导出配置</li>
          </ul>
        </div>

        <div class="panel-muted p-4">
          <h2 class="text-theme mb-2 font-semibold">使用方法：</h2>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>点击九宫格中的图标访问对应网址</li>
            <li>点击"设置"按钮自定义网址</li>
            <li>按 Alt+1 打开扩展弹窗</li>
            <li>输入编号或名称快速跳转</li>
          </ul>
        </div>
      </div>

      <div class="text-muted mt-6 text-center text-sm">
        <p>版本: 2.0.0</p>
        <p class="mt-2">Copyright Mica 2025</p>
      </div>
    </div>
  </div>
</template>
