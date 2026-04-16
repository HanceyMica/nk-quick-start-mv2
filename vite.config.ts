import { defineConfig, Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import unocss from 'unocss/vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 构建后仅整理 about/expert 页面到 dist 根目录，避免破坏 Vite 已生成的入口引用。
function cleanupPlugin(): Plugin {
  return {
    name: 'cleanup-plugin',
    apply: 'build',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      // 移动 src 目录下的文件到 dist 根目录
      const srcDir = resolve(distDir, 'src');
      if (fs.existsSync(srcDir)) {
        const files = fs.readdirSync(srcDir);
        for (const file of files) {
          const srcPath = resolve(srcDir, file);
          const destPath = resolve(distDir, file);
          fs.renameSync(srcPath, destPath);
        }
        fs.rmSync(srcDir, { recursive: true, force: true });
      }
    }
  };
}

export default defineConfig({
  plugins: [
    vue(),
    unocss(),
    cleanupPlugin()
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'index.html',
        options: 'options.html',
        expert: 'src/expert.html',
        about: 'src/about.html',
        background: 'src/background.ts'
      },
      output: {
        entryFileNames: (chunkInfo) => chunkInfo.name === 'background' ? 'background.js' : 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
