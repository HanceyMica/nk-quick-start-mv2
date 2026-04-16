# 九宫格网址跳转

一个基于 Vue 3、Vite 和 CRXJS 的 Chrome 扩展，用九宫格和命令式搜索统一管理常用网址。项目同时支持简单模式与专家模式：简单模式适合九宫格点击跳转，专家模式适合用自定义编号或名称快速检索网址。

## 项目简介

这个项目提供一个可配置的九宫格网址导航扩展：

- 点击扩展弹窗，直接在九宫格中打开常用站点
- 支持把某个格子切换成子网格，做二级导航
- 支持专家模式，使用扁平化网址列表按自定义编号或名称快速跳转
- 所有配置保存在 IndexedDB 中，并在已打开的扩展页面之间实时同步

## 核心功能

- 简单模式九宫格导航
- 子网格套娃导航
- 专家模式扁平网址列表
- popup 紧凑搜索与命令输入
- 配置导入与导出
- 默认配置自动初始化
- 关于页与配置页独立入口

## 项目特性

- 扩展弹窗、设置页、关于页和专家模式页各自独立，职责清晰
- 使用 IndexedDB 保存配置，避免受扩展存储 API 兼容性差异影响
- 通过 `BroadcastChannel` + 页面内事件同步 popup、设置页、关于页和专家页的配置变化
- 简单模式支持二级子网格，兼顾常用网址与分类导航
- 专家模式使用独立扁平列表存储，不受九宫格数量限制
- 支持浅色、深色和跟随系统三种主题模式
- 支持 `Alt+1` / `Command+1` 直接弹出扩展 popup

## 技术栈

- Vue 3
- TypeScript
- Vite
- CRXJS
- UnoCSS
- Chrome Extension Manifest V3
- IndexedDB
- BroadcastChannel

## 安装与运行步骤

1. 安装依赖

```bash
npm install
```

2. 本地开发

```bash
npm run dev
```

3. 类型检查

```bash
npm run typecheck
```

4. 生成构建产物

```bash
npm run build
```

5. 清理构建目录

```bash
npm run clean
```

6. 在 Chrome 中加载扩展

- 打开 `chrome://extensions/`
- 开启“开发者模式”
- 选择“加载已解压的扩展程序”
- 选中构建后的 `dist` 目录

7. 配置快捷键

- 打开 `chrome://extensions/shortcuts`
- 为本扩展设置或修改 `Alt+1` / `Command+1`
- 扩展内部只展示快捷键说明，系统级快捷键实际由 Chrome 管理

## 测试命令

当前项目没有引入单元测试框架，交付前建议至少执行以下命令：

```bash
npm run typecheck
npm run build
```

手动验收建议：

- 检查简单模式下弹窗九宫格跳转是否正常
- 检查子网格进入、左方向键返回与 `←返回` 按钮
- 检查专家模式下扁平网址列表搜索是否正常
- 检查配置保存、导入、导出和重置
- 检查设置页保存后 popup、关于页和专家页是否能同步更新配置或主题
- 检查 `Alt+1` 或 `Command+1` 是否能直接弹出扩展 popup

## 目录结构

```text
.
|-- public/                 静态资源与扩展 manifest
|-- src/
|   |-- components/         弹窗与配置页核心组件
|   |-- styles/             全局样式
|   |-- types/              类型定义与默认配置
|   |-- utils/              IndexedDB 配置读写、旧配置迁移与广播同步
|   |-- App.vue             popup 入口
|   |-- OptionsApp.vue      配置页入口
|   |-- ExpertApp.vue       独立专家模式搜索页
|   |-- AboutApp.vue        关于页入口
|   |-- background.ts       后台脚本
|-- index.html              弹窗 HTML 入口
|-- options.html            配置页 HTML 入口
|-- vite.config.ts          构建与打包配置
|-- uno.config.ts           UnoCSS 配置
|-- Readme.md               项目说明文档
```

## 贡献指南

欢迎提交 Issue 和 PR，建议遵循以下约定：

1. 新功能优先保持单一职责，避免一把梭把逻辑塞进组件
2. 修改配置结构时同步更新类型定义、默认配置和 `normalizeConfig()` 兼容逻辑
3. 修改存储层时同步检查 IndexedDB 迁移、页面广播同步和旧配置兼容路径
4. 提交前至少执行 `npm run typecheck` 和 `npm run build`
5. 保持界面文案简洁，别把扩展写成产品经理周报

## 存储与同步

- 主存储使用 IndexedDB，配置入口统一收敛在 `src/utils/config.ts`
- 首次读取时会尝试从旧版 `chrome.storage.sync` 迁移已有配置到 IndexedDB
- 配置保存后会通过 `BroadcastChannel` 和当前页面事件广播更新，保证多个扩展页面同步刷新
- popup 简单模式下，输入纯数字且命中套娃格子时，会优先直接进入对应子网格

## 许可证

本项目采用 MIT 许可证，详见根目录 `LICENSE`。
