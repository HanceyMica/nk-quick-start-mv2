// Manifest V2 版本会把这个入口编译为经典 background script。
// 当前业务逻辑不依赖后台驻留能力，这里仅保留一个可直接执行的 IIFE 占位入口，
// 以维持目录结构和清单声明，并确保后续扩展后台逻辑时有稳定挂载点。
(() => {
  // 读取 manifest 仅用于保留一个实际可执行的后台入口，不改变任何用户可见行为。
  chrome.runtime.getManifest();
})();
