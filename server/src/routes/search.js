'use strict';

/**
 * 搜索路由 /api/search（architecture.md §6.7）。
 * type=post（默认）匹配帖子标题/正文；type=user 匹配用户名/昵称。
 * 所有 LIKE 均参数化绑定，并对用户输入的通配符做转义。
 */
const express = require('express');
const db = require('../db');
const { AppError, CODE, ok } = require('../utils/response');
const { authOptional } = require('../middleware/auth');
const { parsePagination } = require('../middleware/validate');
const { toUser, buildPostViews, POST_SELECT } = require('../services/views');

const router = express.Router();

function escapeLike(text) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

router.get('/', authOptional, (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) throw new AppError(CODE.VALIDATION, 'q 不能为空');
  const type = req.query.type === undefined ? 'post' : req.query.type;
  if (type !== 'post' && type !== 'user') {
    throw new AppError(CODE.VALIDATION, "type 仅支持 'post' 或 'user'");
  }
  const { page, pageSize, offset } = parsePagination(req.query);
  const like = `%${escapeLike(q)}%`;
  const pagination = (total) => ({
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });

  if (type === 'user') {
    const where = `WHERE u.username LIKE ? ESCAPE '\\' OR u.nickname LIKE ? ESCAPE '\\'`;
    const total = db.prepare(`SELECT COUNT(*) AS n FROM users u ${where}`).get(like, like).n;
    const rows = db
      .prepare(`SELECT u.* FROM users u ${where} ORDER BY u.id ASC LIMIT ? OFFSET ?`)
      .all(like, like, pageSize, offset);
    return ok(res, { q, type, list: rows.map(toUser), pagination: pagination(total) });
  }

  const where = `WHERE p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\'`;
  const total = db.prepare(`SELECT COUNT(*) AS n FROM posts p ${where}`).get(like, like).n;
  const rows = db
    .prepare(
      `${POST_SELECT} ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`
    )
    .all(like, like, pageSize, offset);
  return ok(res, {
    q,
    type,
    list: buildPostViews(db, rows, req.user?.uid ?? null),
    pagination: pagination(total),
  });
});

module.exports = router;
