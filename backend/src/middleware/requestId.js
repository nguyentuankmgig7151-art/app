import { randomUUID } from 'node:crypto';

/**
 * 为每个请求注入唯一 id（req.id），并写入响应头 X-Request-Id，便于日志排查。
 */
export function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

export default requestId;
