import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { config } from './config.js';
import { initStore } from './store/jsonStore.js';
import { COLLECTIONS } from './store/collections.js';
import { ok } from './utils/response.js';
import requestId from './middleware/requestId.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import destinationsRouter from './routes/destinations.js';
import messagesRouter from './routes/messages.js';
import bookingsRouter from './routes/bookings.js';

/**
 * 组装 Express 应用（不监听端口，便于测试复用）。
 * 中间件顺序：requestId → cors → json → 日志 → 路由 → 404 → 错误处理。
 * @returns {import('express').Express}
 */
export function createApp() {
  // 初始化存储：确保目录/数据文件存在并载入内存
  initStore(COLLECTIONS);

  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  if (config.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/api/health', (_req, res) => {
    res.json(ok({ status: 'ok', time: new Date().toISOString() }));
  });

  app.use('/api/destinations', destinationsRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/bookings', bookingsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
