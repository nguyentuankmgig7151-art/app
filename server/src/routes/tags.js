'use strict';

/**
 * 标签路由 /api/tags/*（architecture.md §6.6）。
 */
const express = require('express');
const db = require('../db');
const { AppError, CODE, ok } = require('../utils/response');
const { authOptional } = require('../middleware/auth');
const { parsePagination, invalid } = require('../middleware/validate');
const { buildPostViews, POST_SELECT } = require('../services/views');

const router = express.Router();

const listTags = db.prepare(
  `SELECT t.id, t.name,
          (SELECT COUNT(*) FROM post_tags pt WHERE pt.tag_id = t.id) AS postCount
     FROM tags t
    ORDER BY postCount DESC, t.name ASC
    LIMIT ?`
);
const findTagByName = db.prepare('SELECT id, name FROM tags WHERE name = ?');

// GET /api/tags —— 标签总览（默认 50 个）
router.get('/', (req, res) => {
  let limit = 50;
  if (req.query.limit !== undefined) {
    limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      invalid('limit 需为 1–100 的整数');
    }
  }
  return ok(res, { list: listTags.all(limit) });
});

// GET /api/tags/:name/posts —— 某标签下的帖子列表
router.get('/:name/posts', authOptional, (req, res) => {
  const name = req.params.name;
  const tag = findTagByName.get(name);
  if (!tag) throw new AppError(CODE.NOT_FOUND, '标签不存在');
  const { page, pageSize, offset } = parsePagination(req.query);

  const where = `WHERE EXISTS (SELECT 1 FROM post_tags pt
                    WHERE pt.post_id = p.id AND pt.tag_id = ?)`;
  const total = db.prepare(`SELECT COUNT(*) AS n FROM posts p ${where}`).get(tag.id).n;
  const rows = db
    .prepare(
      `${POST_SELECT} ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`
    )
    .all(tag.id, pageSize, offset);
  const postCount = total;
  return ok(res, {
    tag: { id: tag.id, name: tag.name, postCount },
    list: buildPostViews(db, rows, req.user?.uid ?? null),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

module.exports = router;
