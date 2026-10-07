import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 前端开发服务器：5173；/api 反向代理到后端 3001（见 docs/architecture.md §3）
// 代理目标可经 VITE_PROXY_TARGET 覆盖，默认严格对齐契约的 http://localhost:3001
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
});
