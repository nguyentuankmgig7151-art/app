import { ApiError, fail } from '../utils/response.js';

/**
 * 未匹配路由（404）。
 */
export function notFoundHandler(req, res) {
  res
    .status(404)
    .json(fail('ROUTE_NOT_FOUND', `未知路由: ${req.method} ${req.originalUrl}`));
}

/**
 * 统一错误处理。放在所有路由之后。
 * @param {any} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // express.json() 解析失败
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json(fail('VALIDATION_ERROR', '请求体不是合法的 JSON'));
  }

  const status = err instanceof ApiError ? err.status : 500;
  const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
  const message =
    err instanceof ApiError ? err.message : '服务端异常，请稍后重试';

  if (status >= 500) {
    // 服务端异常保留日志便于排查
    // eslint-disable-next-line no-console
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  return res.status(status).json(fail(code, message));
}

export default { notFoundHandler, errorHandler };
