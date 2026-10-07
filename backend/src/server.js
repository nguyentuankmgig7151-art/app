import { createApp } from './app.js';
import { config } from './config.js';
import { flush } from './store/jsonStore.js';
import { COLLECTIONS } from './store/collections.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[backend] 城市人文旅行 API 已启动: http://localhost:${config.PORT} (${config.NODE_ENV})`
  );
  // eslint-disable-next-line no-console
  console.log(`[backend] 健康检查: http://localhost:${config.PORT}/api/health`);
});

/**
 * 优雅关停：先停止接收新连接，再等待写队列排空，避免半写。
 */
async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n[backend] 收到 ${signal}，正在关闭...`);
  server.close(async () => {
    await Promise.all(COLLECTIONS.map((name) => flush(name)));
    // eslint-disable-next-line no-console
    console.log('[backend] 已安全退出');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default server;
