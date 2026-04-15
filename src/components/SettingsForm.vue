<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Config, ThemeMode } from '../types';
import { createDefaultConfig, createEmptyGrid } from '../types';

const props = defineProps<{
  config: Config;
}>();

const emit = defineEmits<{
  (e: 'save', config: Config): void;
}>();

const localConfig = ref<Config>(JSON.parse(JSON.stringify(props.config)));

watch(() => props.config, (newConfig) => {
  localConfig.value = JSON.parse(JSON.stringify(newConfig));
}, { deep: true });

const gridItemsWithIndex = computed(() =>
  localConfig.value.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === 'grid')
);

const themeOptions: Array<{ value: ThemeMode; label: string; description: string }> = [
  { value: 'light', label: 'Light', description: '始终使用浅色主题' },
  { value: 'dark', label: 'Dark', description: '始终使用深色主题' },
  { value: 'system', label: '跟随系统', description: '根据系统深浅色自动切换' }
];

const modeOptions: Array<{ value: Config['mode']; label: string; description: string }> = [
  { value: 'simple', label: '简单模式', description: '弹窗显示九宫格，并保留设置、关于和明暗切换入口' },
  { value: 'expert', label: '专家模式', description: '弹窗隐藏九宫格，仅保留设置、关于和明暗切换入口' }
];

function updateItem(index: number, field: 'label' | 'url', value: string) {
  (localConfig.value.items[index] as any)[field] = value;
}

function setThemeMode(themeMode: ThemeMode) {
  localConfig.value.themeMode = themeMode;
}

function setMode(mode: Config['mode']) {
  localConfig.value.mode = mode;
}

function toggleType(index: number) {
  const item = localConfig.value.items[index];
  if (item.type === 'url') {
    // 转换为套娃格子
    item.type = 'grid';
    item.grid = createEmptyGrid();
    item.url = '';
  } else {
    // 转换为网址
    item.type = 'url';
    item.grid = undefined;
    item.url = '';
    item.label = `网站${index + 1}`;
  }
}

function updateSubItem(parentIndex: number, subIndex: number, field: 'label' | 'url', value: string) {
  const item = localConfig.value.items[parentIndex];
  if (item.type === 'grid' && item.grid) {
    (item.grid[subIndex] as any)[field] = value;
  }
}

function save() {
  emit('save', localConfig.value);
}

function reset() {
  const defaultConfig = createDefaultConfig();
  localConfig.value = defaultConfig;
  emit('save', defaultConfig);
}

function exportConfig() {
  const data = JSON.stringify(localConfig.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '9key-config.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importConfig() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const config = JSON.parse(text) as Config;
      localConfig.value = config;
      emit('save', config);
    } catch {
      alert('导入失败，文件格式不正确');
    }
  };
  input.click();
}
</script>

<template>
  <div class="space-y-6">
    <div class="panel space-y-4 p-6">
      <div>
        <h2 class="text-theme text-xl font-semibold">弹窗模式</h2>
        <p class="text-muted mt-1 text-sm">控制 popup 默认展示九宫格还是仅显示快捷操作入口。</p>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <button
          v-for="option in modeOptions"
          :key="option.value"
          type="button"
          class="theme-option"
          :class="{ 'theme-option-active': localConfig.mode === option.value }"
          @click="setMode(option.value)"
        >
          <span class="text-sm font-semibold">{{ option.label }}</span>
          <span class="text-muted mt-1 text-xs">{{ option.description }}</span>
        </button>
      </div>
    </div>

    <div class="panel space-y-3 p-6">
      <div>
        <h2 class="text-theme text-xl font-semibold">专家模式快捷键</h2>
        <p class="text-muted mt-1 text-sm">系统级快捷键由 Chrome 管理，扩展内不能直接改写。</p>
      </div>
      <div class="surface-soft rounded-xl p-4">
        <div class="text-secondary text-sm">当前默认快捷键</div>
        <div class="text-theme mt-1 text-lg font-semibold">{{ localConfig.expertShortcut }}</div>
        <p class="text-muted mt-3 text-xs leading-5">
          如需修改，请打开 Chrome 的扩展快捷键设置页面：
          <a
            href="chrome://extensions/shortcuts"
            target="_blank"
            rel="noreferrer"
            class="font-semibold underline underline-offset-2"
          >
            chrome://extensions/shortcuts
          </a>
        </p>
      </div>
    </div>

    <div class="panel space-y-4 p-6">
      <div>
        <h2 class="text-theme text-xl font-semibold">主题模式</h2>
        <p class="text-muted mt-1 text-sm">支持浅色、深色和跟随系统三种模式。</p>
      </div>
      <div class="grid gap-3 md:grid-cols-3">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          type="button"
          class="theme-option"
          :class="{ 'theme-option-active': localConfig.themeMode === option.value }"
          @click="setThemeMode(option.value)"
        >
          <span class="text-sm font-semibold">{{ option.label }}</span>
          <span class="text-muted mt-1 text-xs">{{ option.description }}</span>
        </button>
      </div>
    </div>

    <!-- 主网格配置 -->
    <div class="panel p-6">
      <h2 class="text-theme mb-4 text-xl font-semibold">主网格配置</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="(item, index) in localConfig.items"
          :key="item.id"
          class="surface-card rounded-xl p-4 transition-colors hover:opacity-95"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-secondary font-medium">格子 {{ index + 1 }}</span>
            <button
              @click="toggleType(index)"
              class="toggle-chip rounded-full px-3 py-1 text-sm transition-colors"
              :class="{ 'toggle-chip-active': item.type === 'grid' }"
            >
              {{ item.type === 'grid' ? '套娃格子' : '网址' }}
            </button>
          </div>

          <!-- 网址类型 -->
          <div v-if="item.type === 'url'" class="space-y-2">
            <input
              type="text"
              :value="item.label"
              @input="updateItem(index, 'label', ($event.target as HTMLInputElement).value)"
              placeholder="网站名称"
              class="form-input"
            />
            <input
              type="url"
              :value="item.url"
              @input="updateItem(index, 'url', ($event.target as HTMLInputElement).value)"
              placeholder="https://example.com"
              class="form-input"
            />
          </div>

          <!-- 套娃格子类型 -->
          <div v-else-if="item.type === 'grid'" class="space-y-2">
            <input
              type="text"
              :value="item.label"
              @input="updateItem(index, 'label', ($event.target as HTMLInputElement).value)"
              placeholder="子网格名称"
              class="form-input"
            />
            <div class="text-muted text-xs">子网格包含9个格子，不可再嵌套</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 套娃格子子网格配置 -->
    <div
      v-for="({ item, index: parentIndex }) in gridItemsWithIndex"
      :key="item.id"
      class="panel p-6"
    >
      <h3 class="text-theme mb-4 text-lg font-semibold">子网格: {{ item.label || `格子${parentIndex + 1}` }}</h3>
      <div class="grid grid-cols-3 gap-3">
        <div
          v-for="(subItem, subIndex) in item.grid"
          :key="subItem.id"
          class="surface-soft rounded-lg p-2"
        >
          <input
            type="text"
            :value="subItem.label"
            @input="updateSubItem(parentIndex, subIndex, 'label', ($event.target as HTMLInputElement).value)"
            placeholder="名称"
            class="form-input mb-1 text-xs"
          />
          <input
            type="url"
            :value="subItem.url"
            @input="updateSubItem(parentIndex, subIndex, 'url', ($event.target as HTMLInputElement).value)"
            placeholder="网址"
            class="form-input text-xs"
          />
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex flex-wrap gap-4 justify-center">
      <button
        @click="save"
        class="primary-button px-6 py-3"
      >
        保存配置
      </button>
      <button
        @click="reset"
        class="secondary-button px-6 py-3"
      >
        重置默认
      </button>
      <button
        @click="exportConfig"
        class="secondary-button px-6 py-3"
      >
        导出配置
      </button>
      <button
        @click="importConfig"
        class="secondary-button px-6 py-3"
      >
        导入配置
      </button>
    </div>
  </div>
</template>
