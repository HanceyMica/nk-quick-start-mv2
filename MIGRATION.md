# Manifest V3 -> V2 迁移报告

## 1. 原项目分析

### 1.1 技术栈

- Vue 3
- TypeScript
- Vite
- UnoCSS
- Chrome Extension Manifest V3

### 1.2 目录结构与职责

| 路径 | 作用 |
| --- | --- |
| `index.html` | popup 页面 HTML 入口 |
| `options.html` | 设置页 HTML 入口 |
| `src/about.html` | 关于页 HTML 入口 |
| `src/expert.html` | 专家模式页 HTML 入口 |
| `src/main.ts` | popup Vue 应用入口 |
| `src/options.ts` | 设置页 Vue 应用入口 |
| `src/about.ts` | 关于页 Vue 应用入口 |
| `src/expert.ts` | 专家模式页 Vue 应用入口 |
| `src/App.vue` | popup 根组件，负责读取配置和同步跨页面更新 |
| `src/OptionsApp.vue` | 设置页根组件，负责加载、保存和 toast 提示 |
| `src/AboutApp.vue` | 关于页根组件 |
| `src/ExpertApp.vue` | 专家模式独立搜索页 |
| `src/components/PopupView.vue` | popup 主交互：九宫格、命令输入、主题切换、打开设置/关于页 |
| `src/components/GridView.vue` | 九宫格布局 |
| `src/components/GridItem.vue` | 单个格子展示和 favicon 逻辑 |
| `src/components/SettingsForm.vue` | 配置编辑、导入导出、重置、主题/模式配置 |
| `src/utils/config.ts` | IndexedDB 读写、旧配置迁移、页面广播同步、配置归一化、主题切换 |
| `src/types/index.ts` | 配置结构、默认值、ID 生成与空网格工厂 |
| `src/background.ts` | 原项目保留的后台入口占位文件 |
| `public/manifest.json` | MV3 清单 |
| `vite.config.ts` | 多页面构建与扩展打包配置 |

### 1.3 业务逻辑

- 扩展通过 popup 提供两种工作模式：
  - 简单模式：九宫格 + 子网格套娃导航。
  - 专家模式：扁平化条目搜索与回车直达。
- 设置页允许编辑九宫格、子网格、专家模式条目、主题模式，以及导入/导出/重置配置。
- 所有配置统一保存到 IndexedDB。
- `ensureConfig()` 会在首次安装时生成默认配置，并对旧结构配置进行归一化兼容。
- popup、options、about、expert 页面通过 `BroadcastChannel` + 本页自定义事件同步配置更新。
- 关于页和专家页为独立页面入口，由 popup 通过 `chrome.tabs.create()` 打开。

### 1.4 扩展 API 使用情况

本项目源码中实际使用到的扩展 API 很少，主要为：

- `chrome.tabs.create`
- `chrome.runtime.getURL`

未发现以下 MV3 专属运行时代码：

- `chrome.action` 的脚本调用
- `chrome.scripting.executeScript`
- `chrome.runtime.onMessage` / `chrome.tabs.sendMessage`
- `content_scripts`
- `service_worker` 后台逻辑实现

结论：本次迁移的重点并不在业务脚本改写，而在 manifest 结构、打包方式与后台入口输出格式。

## 2. V3 与 V2 API 映射

| MV3 项 | MV2 对应项 | 本项目处理方式 |
| --- | --- | --- |
| `manifest_version: 3` | `manifest_version: 2` | 已改为 2 |
| `action` | `browser_action` | 已改为 `browser_action` |
| `host_permissions` | `permissions` 中的 URL 权限 | 已将 `<all_urls>` 并入 `permissions` |
| `_execute_action` | `_execute_browser_action` | 已改为 `_execute_browser_action` |
| `service_worker` | `background.scripts` | 原项目未真正声明 service worker；V2 版本显式声明 `background.scripts` |
| ESM background | 经典脚本 background | 通过 Vite 单独输出 `background.js`，供 MV2 直接加载 |
| `chrome.scripting.executeScript` | `chrome.tabs.executeScript` | 原项目未使用，无需替换 |
| `chrome.action` 运行时代码 | `chrome.browserAction` | 原项目未使用运行时代码，无需替换 |

## 3. 文件改动

### 3.1 `package.json`

- 项目名改为 `nk-quick-start-manifestv2`。
- 移除仅服务于 MV3 打包的 `@crxjs/vite-plugin`。
- 保留 Vue、TypeScript、Vite、UnoCSS 等其余依赖不变。

### 3.2 `package-lock.json`

- 重新执行 `npm install` 后生成，去除了 `@crxjs/vite-plugin` 相关锁定信息。

### 3.3 `vite.config.ts`

- 移除 CRXJS 插件及其 manifest 注入逻辑。
- 保留原多页面构建方式：
  - `index.html`
  - `options.html`
  - `src/about.html`
  - `src/expert.html`
- 新增 `src/background.ts` 构建入口。
- 将后台入口稳定输出为根目录 `background.js`，满足 Manifest V2 `background.scripts` 的直接加载要求。
- 保留构建后将 `dist/src/*.html` 移到 `dist/` 根目录的整理逻辑，维持原页面路径不变。

### 3.4 `public/manifest.json`

- `manifest_version` 从 3 改为 2。
- `action` 改为 `browser_action`。
- 新增：

```json
"background": {
  "scripts": ["background.js"]
}
```

- `host_permissions` 删除，并将 `<all_urls>` 合并进 `permissions`。
- 保留 `storage` 权限，仅用于首次启动时读取旧版 `chrome.storage.sync` 配置并迁移到 IndexedDB。
- 命令键名从 `_execute_action` 改为 `_execute_browser_action`。
- `description` 末尾追加 ` (Manifest V2 port)`。
- 版本号保持与原项目一致，为 `2.0.0`。

### 3.5 `src/background.ts`

- 保留原目录结构与入口文件位置不变。
- 将原占位入口改为可直接执行的 IIFE，占位执行一次 `chrome.runtime.getManifest()`，确保 MV2 `background.scripts` 可以直接加载且不会被构建工具摇树删除。
- 未新增业务逻辑，确保与原项目“后台仅占位、不承载用户功能”的现状一致。

### 3.6 其余源代码文件

- `src/App.vue`
- `src/OptionsApp.vue`
- `src/ExpertApp.vue`
- `src/AboutApp.vue`
- `src/components/*`
- `src/utils/config.ts`
- `src/types/index.ts`
- `src/styles/main.css`
- `index.html`
- `options.html`
- `src/about.html`
- `src/expert.html`

其中以下文件已为 IndexedDB 与页面广播同步做兼容改造：

- `src/utils/config.ts`
- `src/App.vue`
- `src/OptionsApp.vue`
- `src/ExpertApp.vue`
- `src/AboutApp.vue`

其余文件内容保持与原项目一致，未改动业务逻辑、UI 交互、配置结构、搜索行为、导入导出逻辑与导航规则。

## 4. 功能一致性说明

### 4.1 已保持一致的部分

- popup、options、about、expert 四个页面入口与相对路径保持一致。
- Vue 组件结构与样式体系保持一致。
- 九宫格导航、子网格导航、专家模式搜索、主题切换、配置导入/导出/重置全部保持不变。
- 配置改为由 IndexedDB 保存。
- 页面跳转仍由 `chrome.tabs.create()` 完成。
- `chrome.runtime.getURL('options.html')` / `chrome.runtime.getURL('about.html')` 的使用方式保持不变。
- 页面间配置同步改为 `BroadcastChannel` + 本页自定义事件，替代 `chrome.storage.onChanged`。

### 4.2 不存在但已核对的项

原项目没有以下实现，因此 V2 版本也未新增：

- 内容脚本注入
- 跨上下文消息通信
- `chrome.scripting.executeScript`
- 后台事件监听器
- 跨域网络请求逻辑

这意味着“保持一致”的结果是：这些能力在原项目与迁移项目中均不存在，不属于迁移差异项。

## 5. 构建与静态验证

### 5.1 执行命令

```bash
npm install
npm run build
```

### 5.2 结果

- `npm install` 成功。
- `npm run build` 成功。
- `dist/manifest.json` 已输出为 Manifest V2。
- `dist/background.js` 已生成。
- `dist/about.html` 与 `dist/expert.html` 已整理到根目录。
- 配置主存储已切换到 IndexedDB，并保留对旧版 `chrome.storage.sync` 配置的一次性迁移逻辑。

### 5.3 构建产物核对

- `dist/manifest.json`
- `dist/index.html`
- `dist/options.html`
- `dist/about.html`
- `dist/expert.html`
- `dist/background.js`
- `dist/assets/*`

## 6. 浏览器测试

### 6.1 目标

按需求验证以下项：

- 图标点击弹出页面
- 后台脚本生命周期
- 内容脚本注入
- 跨域请求
- 本地存储
- 消息通信
- 控制台无报错

### 6.2 当前环境可执行性

- 本机标准路径检测到 Chrome：`C:\Program Files\Google\Chrome\Application\chrome.exe`
- 未在标准路径或 `PATH` 中检测到 Firefox 可执行文件
- 当前自动化浏览器环境无法正常访问浏览器内部扩展管理页，无法通过 UI 执行“加载已解压扩展”

### 6.3 已完成验证

#### 静态与构建验证

- 已确认 MV2 manifest 结构正确。
- 已确认 `background.js` 被生成。
- 已确认 popup/options/about/expert 页面产物存在。
- 已确认配置主存储改为 IndexedDB，旧版 `chrome.storage.sync` 仅作为首次迁移来源。
- 已确认页面间同步改为 `BroadcastChannel` + 本页事件广播。

#### 自动化浏览器尝试

- 已尝试通过浏览器自动化访问 Chrome/Edge/Firefox 扩展管理入口。
- 结果：
  - 无法进入可操作的扩展管理页面；
  - 因此无法真正执行 unpacked extension 加载；
  - 也无法在真实扩展上下文中验证 popup、background、storage 生命周期。

### 6.4 未能完成的验证项

受当前环境限制，以下项未能在真实扩展上下文中完成：

- Chrome 90+ 加载已解压扩展后的点击图标弹窗验证
- Chrome 90+ 后台生命周期验证
- Firefox 102+ 加载与兼容性验证
- 扩展上下文中的 IndexedDB 实际读写验证
- 内容脚本、消息通信、跨域请求验证

说明：这些项在源项目中本身也未实现或未涉及，但由于无法真实加载扩展，无法形成“浏览器运行时证据”。

## 7. 手动复测步骤

后续维护者可在具备 Chrome 与 Firefox 的本机环境中按以下步骤复测。

### 7.1 Chrome 90+

1. 进入项目目录执行：

```bash
npm install
npm run build
```

2. 打开 `chrome://extensions/`
3. 开启“开发者模式”
4. 点击“加载已解压的扩展程序”
5. 选择 `d:\Project\nqs-manifestv2\nk-quick-start-manifestv2\dist`
6. 验证以下行为：
   - 点击工具栏图标后打开 popup
   - 简单模式九宫格可打开网址
   - 子网格可进入和返回
   - `/D` `/L` `/W` `/S` `/A` 命令可用
   - 设置页保存后 popup 可实时同步配置
   - 关于页与设置页可正常打开
   - `Alt+1` / `Command+1` 可唤起 popup
   - 扩展页面 DevTools 与 background page 无控制台报错

### 7.2 Firefox 102+

1. 执行：

```bash
npm install
npm run build
```

2. 打开 `about:debugging#/runtime/this-firefox`
3. 选择“临时载入附加组件”
4. 选择 `d:\Project\nqs-manifestv2\nk-quick-start-manifestv2\dist\manifest.json`
5. 重复与 Chrome 相同的 popup、设置、主题、搜索、存储验证
6. 查看扩展页面与后台页控制台是否有报错

## 8. 最终结论

- 已完成源码级迁移与构建级迁移。
- 已在目标目录生成可构建的 Manifest V2 项目。
- 已生成符合要求的 `manifest.json`，并在 `description` 末尾追加 ` (Manifest V2 port)`。
- 已保持原业务逻辑、UI、配置结构与页面入口不变。
- 已将后台入口转为 MV2 可直接加载的 IIFE `background.js`。
- 已完成构建与静态核查。
- 由于当前环境缺少 Firefox 且浏览器自动化无法进入扩展管理页，实机加载验证仍需在本机图形化浏览器中按本报告步骤补充完成。
