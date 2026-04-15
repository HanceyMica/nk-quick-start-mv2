<script setup lang="ts">
import { ref, computed } from 'vue';
import type { GridItem } from '../types';

const props = defineProps<{
  item: GridItem;
  index: number;
}>();

const faviconError = ref(false);

const faviconUrl = computed(() => {
  if (props.item.type !== 'url' || !props.item.url) return '';
  try {
    const urlObj = new URL(props.item.url);
    return urlObj.origin + '/favicon.ico';
  } catch {
    return '';
  }
});

const isGridType = computed(() => props.item.type === 'grid');

function handleError() {
  faviconError.value = true;
}
</script>

<template>
  <div
    class="tile-card flex h-20 cursor-pointer flex-col items-center justify-center transition-all duration-200 hover:-translate-y-1"
    :class="{ 'tile-card-grid': isGridType }"
  >
    <!-- 套娃图标 -->
    <div v-if="isGridType" class="text-secondary i-carbon-data-blob mb-1 text-3xl"></div>

    <!-- Favicon -->
    <img
      v-else-if="faviconUrl && !faviconError"
      :src="faviconUrl"
      class="w-6 h-6 object-contain mb-1"
      @error="handleError"
    />

    <!-- 默认数字图标 -->
    <div
      v-else
      class="text-secondary mb-1 flex h-6 w-6 items-center justify-center text-lg font-bold"
    >
      {{ index + 1 }}
    </div>

    <!-- 标签 -->
    <span class="text-theme max-w-full truncate px-1 text-center text-xs">
      {{ item.label || `网站${index + 1}` }}
    </span>
  </div>
</template>
