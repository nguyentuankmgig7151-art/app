'use strict';

/**
 * 统一错误处理（architecture.md §8.7）。
 * 为什么：集中把 AppError 映射为标准响应，未知异常统一 5000，
 * 且绝不把堆栈/SQL 细节写进响应体。
 */
const { AppError, CODE, fail } = require('../utils/response');

// 404：未命中任何路由
function notFoundHandler(req, res) {
  return fail(res, CODE.NOT_FOUND, `接口不存在：${req.method} ${req.originalUrl}`);
}

// 兜底错误处理（Express 4 必须保留 4 个参数）
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return fail(res, err.code, err.message);
  }
  // 已知的 JSON 解析错误归类为参数错误
  if (err && err.type === 'entity.parse.failed') {
    return fail(res, CODE.VALIDATION, '请求体不是合法的 JSON');
  }
  console.error('[error]', err); // 服务端保留完整日志，但不返回给客户端
  return fail(res, CODE.INTERNAL, '服务器内部错误');
}

module.exports = { notFoundHandler, errorHandler };
