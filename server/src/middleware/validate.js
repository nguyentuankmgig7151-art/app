'use strict';

/**
 * 入参校验工具（architecture.md §8.1：写接口必须在路由层校验）。
 * 约定：校验失败直接 throw AppError(CODE.VALIDATION, 明确 message)。
 */
const { AppError, CODE } = require('../utils/response');

function invalid(message) {
  throw new AppError(CODE.VALIDATION, message);
}

/** 必填字符串 */
function requireString(value, field, { min = 1, max = Infinity } = {}) {
  if (typeof value !== 'string') invalid(`${field} 必须为字符串`);
  const v = value.trim();
  if (v.length < min) invalid(`${field} 长度不能少于 ${min} 个字符`);
  if (v.length > max) invalid(`${field} 长度不能超过 ${max} 个字符`);
  return v;
}

/** 可选字符串：undefined/null 返回 undefined；空串按「未提供」处理 */
function optionalString(value, field, { min = 0, max = Infinity } = {}) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') invalid(`${field} 必须为字符串`);
  const v = value.trim();
  if (v.length < min) invalid(`${field} 长度不能少于 ${min} 个字符`);
  if (v.length > max) invalid(`${field} 长度不能超过 ${max} 个字符`);
  return v;
}

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function validateUsername(value) {
  if (typeof value !== 'string' || !USERNAME_RE.test(value)) {
    invalid('username 需为 3–20 位字母、数字或下划线');
  }
  return value;
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 6 || value.length > 64) {
    invalid('password 长度需为 6–64 个字符');
  }
  return value;
}

/** 标签：可选数组，元素 1–20 字符，最多 5 个；去重后返回 */
function validateTags(value) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new AppError(CODE.TAGS_INVALID, 'tags 必须为数组');
  const cleaned = [];
  for (const item of value) {
    if (typeof item !== 'string') throw new AppError(CODE.TAGS_INVALID, '标签必须为字符串');
    const name = item.trim();
    if (name.length < 1 || name.length > 20) {
      throw new AppError(CODE.TAGS_INVALID, '标签长度需为 1–20 个字符');
    }
    if (!cleaned.includes(name)) cleaned.push(name);
  }
  if (cleaned.length > 5) throw new AppError(CODE.TAGS_INVALID, '标签最多 5 个');
  return cleaned;
}

/** 解析分页参数：page 默认 1、pageSize 默认 10、最大 50（architecture.md §5.4） */
function parsePagination(query) {
  const pageRaw = query.page === undefined ? 1 : Number(query.page);
  const sizeRaw = query.pageSize === undefined ? 10 : Number(query.pageSize);
  if (!Number.isInteger(pageRaw) || pageRaw < 1) invalid('page 需为不小于 1 的整数');
  if (!Number.isInteger(sizeRaw) || sizeRaw < 1 || sizeRaw > 50) {
    invalid('pageSize 需为 1–50 的整数');
  }
  return { page: pageRaw, pageSize: sizeRaw, offset: (pageRaw - 1) * sizeRaw };
}

/** 解析路径中的正整数 id */
function parseId(value, field = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) invalid(`${field} 必须为正整数`);
  return id;
}

module.exports = {
  invalid,
  requireString,
  optionalString,
  validateUsername,
  validatePassword,
  validateTags,
  parsePagination,
  parseId,
};
