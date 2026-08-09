import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import axios from 'axios';
import App from './App.tsx';
import './index.css';

// 全局请求超时：多源解析（尤其 JM 多域名轮询）在源站慢时可能耗时较长，
// 但绝不能无限等待——超时后由各页面 catch 显示明确的"搜索失败/超时"提示。
axios.defaults.timeout = 45000;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 首屏渲染完成 → 等待首页关键图片（Hero 看板娘，非懒加载）真正下载完成后，再关闭加载进度屏
const finishLoader = () => (window as any).__finishAppLoader?.();

const isHeroImage = (img: HTMLImageElement) => img.getAttribute('loading') !== 'lazy';

// 等待首页图片元素出现并全部下载完成。
// LandingPage 是懒加载 chunk，渲染可能晚于 main.tsx，因此先轮询等待元素出现。
// 仅首页（/）等待看板娘图片；其他路由（如 /explore）没有 hero 图，直接放行，
// 避免整页重载到非首页时进度屏卡满超时。
const waitForHeroImages = (): Promise<void> =>
  new Promise((resolve) => {
    if (window.location.pathname !== '/') return resolve();
    const deadline = Date.now() + 5000;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const tryWait = () => {
      const imgs = Array.from(document.querySelectorAll('section img')).filter((el): el is HTMLImageElement =>
        el instanceof HTMLImageElement && isHeroImage(el)
      );
      if (imgs.length === 0) {
        if (Date.now() < deadline) setTimeout(tryWait, 120);
        else settle(); // 超时仍无图片元素（如非首页路由），放行
        return;
      }
      let pending = imgs.length;
      const done = () => {
        pending -= 1;
        if (pending <= 0) settle();
      };
      imgs.forEach((img) => {
        if (img.complete) done();
        else {
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true }); // 图片失败也放行，避免卡住
        }
      });
    };
    tryWait();
  });

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    // 兜底：最多等 5s，防止源图异常导致进度屏永久停留
    const timeout = new Promise<void>((r) => setTimeout(r, 5000));
    Promise.race([waitForHeroImages(), timeout]).then(() => {
      // 给浏览器一帧时间完成首屏绘制，再淡出进度屏
      requestAnimationFrame(() => requestAnimationFrame(finishLoader));
    });
  });
});
