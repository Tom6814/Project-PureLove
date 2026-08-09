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

// 首屏渲染完成 → 关闭 index.html 的独立加载进度屏
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    (window as any).__finishAppLoader?.();
  });
});
