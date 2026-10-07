/**
 * 服务入口：承载 /api 接口，同时把 public 目录作为静态站点对外提供，
 * 因此既可以用 http://localhost:4000/ 访问完整应用，也支持从预览服务
 * (http://localhost:3001/preview/...) 加载页面后跨域调用本服务的 API。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { handleApiRequest } from './api.js';
import { databasePath } from './db.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(currentDir, '..', 'public');

const port = Number(process.env.PORT ?? 4000);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

const server = createServer(async (request, response) => {
  // 允许从预览服务等其它来源加载的页面调用本 API
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  const handledByApi = await handleApiRequest(request, response, requestUrl);
  if (handledByApi) {
    return;
  }

  await serveStaticFile(requestUrl.pathname, response);
});

/** 提供静态资源；路径不存在时回退到 index.html 以支持单页应用路由 */
async function serveStaticFile(pathname, response) {
  const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const resolvedPath = resolve(publicDir, normalize(relativePath));

  // 防目录穿越：解析后的路径必须仍位于 public 目录内
  if (resolvedPath !== publicDir && !resolvedPath.startsWith(publicDir + sep)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('禁止访问该路径');
    return;
  }

  const targetPath = existsSync(resolvedPath) ? resolvedPath : join(publicDir, 'index.html');

  try {
    const content = await readFile(targetPath);
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extname(targetPath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(content);
  } catch (error) {
    console.error('[static] 读取失败：', error.message);
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('资源不存在');
  }
}

server.listen(port, () => {
  console.log(`凭证管理系统已启动：http://localhost:${port}`);
  console.log(`数据库文件：${databasePath}`);
});

/** 进程退出时关闭数据库连接，确保 WAL 正常落盘 */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    database.close();
    server.close(() => process.exit(0));
  });
}
