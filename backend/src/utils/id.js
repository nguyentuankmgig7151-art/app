import { randomUUID } from 'node:crypto';

/**
 * 生成全局唯一 id。
 * @returns {string}
 */
export function newId() {
  return randomUUID();
}

/**
 * 当前时间的 ISO 8601 字符串。
 * @returns {string}
 */
export function nowIso() {
  return new Date().toISOString();
}

export default { newId, nowIso };
