/**
 * 统一响应包装与业务错误类型。
 * 成功：{ success: true, data }
 * 失败：{ success: false, error: { code, message } }
 */

/**
 * 构造成功响应体。
 * @template T
 * @param {T} data
 * @returns {{ success: true, data: T }}
 */
export function ok(data) {
  return { success: true, data };
}

/**
 * 构造失败响应体。
 * @param {string} code
 * @param {string} message
 * @returns {{ success: false, error: { code: string, message: string } }}
 */
export function fail(code, message) {
  return { success: false, error: { code, message } };
}

/**
 * 可携带 HTTP 状态码的业务异常，供中间件统一序列化。
 */
export class ApiError extends Error {
  /**
   * @param {number} status HTTP 状态码
   * @param {string} code 错误码
   * @param {string} message 可读信息
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  static badRequest(message, code = 'VALIDATION_ERROR') {
    return new ApiError(400, code, message);
  }

  static notFound(message = '资源不存在', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static internal(message = '服务端异常') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}

export default { ok, fail, ApiError };
