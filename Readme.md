# 九宫格网址跳转

一个基于 Vue 3、Vite 和 CRXJS 的 Chrome 扩展，用九宫格把常用网址收拢到一个弹窗里，支持套娃子网格和专家模式快速检索，主打一个少废话、快直达。

## 项目简介

这个项目提供一个可配置的九宫格网址导航扩展：

- 点击扩展弹窗，直接在九宫格中打开常用站点
- 支持把某个格子切换成子网格，做二级导航
- 支持专家模式，通过快捷键打开搜索面板，按编号或名称直达网址
- 所有配置保存在 `chrome.storage.sync` 中，可跨设备同步

## 核心功能

- 九宫格网址跳转
- 子网格套娃导航
- 专家模式搜索跳转
- 配置导入与导出
- 默认配置自动初始化
- 关于页与配置页独立入口

## 项目特性

- 扩展弹窗、设置页、关于页和专家模式页各自独立，职责清晰
- 使用 `chrome.storage.sync` 保存配置，便于在不同设备间同步
- 支持二级子网格，兼顾常用网址与分类导航
- 支持浅色、深色和跟随系统三种主题模式

## 技术栈

- Vue 3
- TypeScript
- Vite
- CRXJS
- UnoCSS
- Chrome Extension Manifest V3

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

## 测试命令

当前项目没有引入单元测试框架，交付前建议至少执行以下命令：

```bash
npm run typecheck
npm run build
```

手动验收建议：

- 检查弹窗九宫格跳转是否正常
- 检查子网格进入、返回与首页导航
- 检查配置保存、导入、导出和重置
- 检查 `Alt+9` 或 `Command+9` 是否能打开专家模式

## 目录结构

```text
.
|-- public/                 静态资源与扩展 manifest
|-- src/
|   |-- components/         弹窗与配置页核心组件
|   |-- styles/             全局样式
|   |-- types/              类型定义与默认配置
|   |-- utils/              配置读写公共逻辑
|   |-- App.vue             弹窗入口
|   |-- OptionsApp.vue      配置页入口
|   |-- ExpertApp.vue       专家模式入口
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
2. 修改配置结构时同步更新类型定义和默认配置
3. 提交前至少执行 `npm run typecheck` 和 `npm run build`
4. 保持界面文案简洁，别把扩展写成产品经理周报

## 许可证

本项目采用 MIT 许可证，详见根目录 `LICENSE`。
