'use strict';

/**
 * 密码哈希封装：统一使用 bcrypt（bcryptjs 纯 JS 实现，算法为 bcrypt，cost = 10）。
 * 为什么包装：全站只允许通过本模块处理密码，避免误用明文/MD5/SHA1（architecture.md §4.4、§8.3）。
 */
const bcrypt = require('bcryptjs');

const COST = 10;

function hashPassword(plain) {
  return bcrypt.hashSync(plain, COST);
}

function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compareSync(plain, hash);
}

module.exports = { hashPassword, verifyPassword };
