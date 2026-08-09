import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      // 手动分包：第三方大依赖拆成独立 chunk，利用浏览器长期缓存 + 首屏并发加载
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('scheduler')) return 'vendor-react';
              if (id.includes('framer-motion') || id.includes('motion')) return 'vendor-motion';
              if (id.includes('supabase')) return 'vendor-supabase';
              if (id.includes('axios') || id.includes('cheerio')) return 'vendor-net';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('date-fns')) return 'vendor-date';
              return 'vendor-misc';
            }
          },
        },
      },
    },
  };
});
