'use strict';

/**
 * 统一响应与错误码（architecture.md §5）。
 * 所有接口返回 { code, message, data }；code=0 表示业务成功。
 */

// 业务错误码 → 默认 HTTP 状态码
const CODE = {
  OK: 0,
  VALIDATION: 1001, // 参数校验失败
  USERNAME_TAKEN: 1002, // 用户名已存在
  BAD_CREDENTIALS: 1003, // 用户名或密码错误
  TAGS_INVALID: 1004, // 标签数量/格式不合法
  UNAUTHENTICATED: 2001, // 未登录 / token 缺失
  INVALID_TOKEN: 2002, // token 无效或过期
  FORBIDDEN: 3001, // 无权限操作该资源
  SELF_FOLLOW: 3002, // 不能关注自己
  NOT_FOUND: 4001, // 资源不存在
  INTERNAL: 5000, // 服务器内部错误
};

const HTTP_STATUS = {
  [CODE.OK]: 200,
  [CODE.VALIDATION]: 400,
  [CODE.USERNAME_TAKEN]: 400,
  [CODE.BAD_CREDENTIALS]: 400,
  [CODE.TAGS_INVALID]: 400,
  [CODE.UNAUTHENTICATED]: 401,
  [CODE.INVALID_TOKEN]: 401,
  [CODE.FORBIDDEN]: 403,
  [CODE.SELF_FOLLOW]: 400,
  [CODE.NOT_FOUND]: 404,
  [CODE.INTERNAL]: 500,
};

/**
 * 业务异常。路由/service 中 throw new AppError(CODE.XXX, 'message')，
 * 由统一错误中间件转换为标准响应。
 */
class AppError extends Error {
  constructor(code, message) {
    super(message || 'error');
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = HTTP_STATUS[code] || 500;
  }
}

/** 成功响应。status 默认由 code 决定（0 → 200），创建类接口可显式传 201。 */
function ok(res, data = null, status = 200) {
  return res.status(status).json({ code: CODE.OK, message: 'ok', data });
}

/** 失败响应。 */
function fail(res, code, message) {
  const status = HTTP_STATUS[code] || 500;
  return res.status(status).json({ code, message: message || 'error', data: null });
}

module.exports = { CODE, HTTP_STATUS, AppError, ok, fail };
