'use strict';

/**
 * JWT 鉴权中间件（architecture.md §6、§8.6）。
 * - authRequired：必须携带有效 Bearer token，否则 2001/2002。
 * - authOptional：未带 token 放行（req.user = null），带了则必须有效。
 */
const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { AppError, CODE } = require('../utils/response');

/** 签发 token，payload 固定 { uid, username }，有效期取 JWT_EXPIRES_IN。 */
function signToken(user) {
  return jwt.sign({ uid: user.id, username: user.username }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    // 过期与签名错误统一返回 2002，不向外泄露具体原因。
    throw new AppError(CODE.INVALID_TOKEN, 'token 无效或已过期');
  }
}

function authRequired(req, res, next) {
  const token = extractToken(req);
  if (!token) return next(new AppError(CODE.UNAUTHENTICATED, '请先登录'));
  try {
    const payload = verifyToken(token);
    req.user = { uid: payload.uid, username: payload.username };
    next();
  } catch (err) {
    next(err);
  }
}

function authOptional(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = verifyToken(token);
    req.user = { uid: payload.uid, username: payload.username };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { signToken, authRequired, authOptional };
