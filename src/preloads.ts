// 路由 chunk 预加载：悬停导航链接 / 首屏加载完成后提前拉取，点击时即开即用
// 独立文件避免 Layout ↔ App 循环依赖
export const preloadLanding = () => import('./pages/LandingPage');
export const preloadHome = () => import('./pages/HomePage');
export const preloadManga = () => import('./pages/MangaPage');
export const preloadSubmit = () => import('./pages/SubmitPage');
export const preloadAdmin = () => import('./pages/AdminPage');
export const preloadSettings = () => import('./pages/SettingsPage');
export const preloadUser = () => import('./pages/UserPage');

/** 预热常用路由：首屏之后立刻后台加载，用户切换时无需等待 */
export const preloadCommon = () => {
  preloadHome();
  preloadManga();
  preloadSubmit();
};
