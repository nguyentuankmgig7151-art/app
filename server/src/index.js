'use strict';

/**
 * Express 入口（architecture.md §3、§6、§8）。
 * 负责：加载配置、启用 CORS/JSON、挂载各路由、统一错误处理、监听端口。
 */
const express = require('express');
const cors = require('cors');
const { config, assertConfig } = require('./config');

// 启动前校验必填环境变量（JWT_SECRET 缺失直接报错退出）。
try {
  assertConfig();
} catch (err) {
  console.error(`[config] ${err.message}`);
  process.exit(1);
}

const db = require('./db'); // 触发建表与 seed
const { ok } = require('./utils/response');
const { notFoundHandler, errorHandler } = require('./middleware/error');

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const followsRouter = require('./routes/follows');
const postsRouter = require('./routes/posts');
const likesRouter = require('./routes/likes');
const commentsRouter = require('./routes/comments');
const tagsRouter = require('./routes/tags');
const searchRouter = require('./routes/search');

const app = express();

// CORS：来源从环境变量读取，默认放行 Vite 开发服务器。
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));

// 健康检查，便于启动后快速确认服务可用。
app.get('/api/health', (req, res) => ok(res, { status: 'up', time: new Date().toISOString() }));

// 路由挂载顺序：路径相同时按注册顺序匹配，users→follows、posts→likes 互不冲突。
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/users', followsRouter);
app.use('/api/posts', postsRouter);
app.use('/api/posts', likesRouter);
app.use('/api', commentsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/search', searchRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  const base = `http://localhost:${config.port}`;
  console.log('社区网站后端已启动');
  console.log(`  监听端口 : ${config.port}`);
  console.log(`  本地地址 : ${base}`);
  console.log(`  API 基址 : ${base}/api`);
  console.log(`  健康检查 : ${base}/api/health`);
  console.log(`  数据库   : ${config.dbPath}`);
  console.log(`  允许来源 : ${config.corsOrigin}`);
});

// 优雅退出：关闭 HTTP 服务与数据库连接。
function shutdown() {
  server.close(() => {
    try {
      db.close();
    } catch (_) {
      /* ignore */
    }
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
