'use strict';

/**
 * 认证路由 /api/auth/*（architecture.md §6.1）。
 */
const express = require('express');
const db = require('../db');
const { AppError, CODE, ok } = require('../utils/response');
const { signToken, authRequired } = require('../middleware/auth');
const { hashPassword, verifyPassword } = require('../utils/password');
const { validateUsername, validatePassword, optionalString } = require('../middleware/validate');
const { toUser } = require('../services/views');

const router = express.Router();

const findUserByName = db.prepare('SELECT * FROM users WHERE username = ?');
const findUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const insertUser = db.prepare(
  'INSERT INTO users (username, password_hash, nickname, avatar, bio) VALUES (?, ?, ?, NULL, NULL)'
);

// POST /api/auth/register
router.post('/register', (req, res) => {
  const username = validateUsername(req.body?.username);
  const password = validatePassword(req.body?.password);
  const nickname = optionalString(req.body?.nickname, 'nickname', { min: 1, max: 20 }) ?? username;

  if (findUserByName.get(username)) {
    throw new AppError(CODE.USERNAME_TAKEN, '用户名已存在');
  }

  const info = insertUser.run(username, hashPassword(password), nickname);
  const user = findUserById.get(Number(info.lastInsertRowid));
  const token = signToken(user);
  return ok(res, { token, user: toUser(user) }, 201);
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const username = req.body?.username;
  const password = req.body?.password;
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new AppError(CODE.VALIDATION, 'username 与 password 必填');
  }
  const user = findUserByName.get(username.trim());
  // 用户不存在与密码错误返回同一错误码，避免用户名枚举。
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new AppError(CODE.BAD_CREDENTIALS, '用户名或密码错误');
  }
  const token = signToken(user);
  return ok(res, { token, user: toUser(user) });
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
  const user = findUserById.get(req.user.uid);
  if (!user) throw new AppError(CODE.NOT_FOUND, '用户不存在');
  return ok(res, { user: toUser(user) });
});

module.exports = router;
