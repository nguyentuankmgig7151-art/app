'use strict';

/**
 * 评论路由（挂载于 /api，architecture.md §6.4）。
 * GET    /api/posts/:id/comments
 * POST   /api/posts/:id/comments
 * DELETE /api/comments/:id
 */
const express = require('express');
const db = require('../db');
const { AppError, CODE, ok } = require('../utils/response');
const { authRequired, authOptional } = require('../middleware/auth');
const { parseId, parsePagination, requireString } = require('../middleware/validate');

const router = express.Router();

const findPost = db.prepare('SELECT id, author_id FROM posts WHERE id = ?');
const findComment = db.prepare(
  `SELECT c.id, c.post_id, c.author_id, c.content, c.created_at,
          u.username, u.nickname, u.avatar
     FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.id = ?`
);
const countComments = db.prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id = ?');
const insertComment = db.prepare(
  'INSERT INTO comments (post_id, author_id, content) VALUES (?, ?, ?)'
);
const deleteComment = db.prepare('DELETE FROM comments WHERE id = ?');

function toComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    content: row.content,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      username: row.username,
      nickname: row.nickname,
      avatar: row.avatar ?? null,
    },
  };
}

// GET /api/posts/:id/comments —— 评论列表（按时间正序）
router.get('/posts/:id/comments', authOptional, (req, res) => {
  const postId = parseId(req.params.id);
  if (!findPost.get(postId)) throw new AppError(CODE.NOT_FOUND, '帖子不存在');
  const { page, pageSize, offset } = parsePagination(req.query);
  const total = countComments.get(postId).n;
  const rows = db
    .prepare(
      `SELECT c.id, c.post_id, c.author_id, c.content, c.created_at,
              u.username, u.nickname, u.avatar
         FROM comments c JOIN users u ON u.id = c.author_id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC, c.id ASC LIMIT ? OFFSET ?`
    )
    .all(postId, pageSize, offset);
  return ok(res, {
    list: rows.map(toComment),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// POST /api/posts/:id/comments —— 发表评论
router.post('/posts/:id/comments', authRequired, (req, res) => {
  const postId = parseId(req.params.id);
  if (!findPost.get(postId)) throw new AppError(CODE.NOT_FOUND, '帖子不存在');
  const content = requireString(req.body?.content, 'content', { min: 1, max: 500 });
  const info = insertComment.run(postId, req.user.uid, content);
  const row = findComment.get(Number(info.lastInsertRowid));
  return ok(res, { comment: toComment(row) }, 201);
});

// DELETE /api/comments/:id —— 评论作者或帖子作者均可删除
router.delete('/comments/:id', authRequired, (req, res) => {
  const id = parseId(req.params.id);
  const comment = findComment.get(id);
  if (!comment) throw new AppError(CODE.NOT_FOUND, '评论不存在');
  const post = findPost.get(comment.post_id);
  const isCommentAuthor = comment.author_id === req.user.uid;
  const isPostAuthor = post && post.author_id === req.user.uid;
  if (!isCommentAuthor && !isPostAuthor) {
    throw new AppError(CODE.FORBIDDEN, '无权删除该评论');
  }
  deleteComment.run(id);
  return ok(res, { id });
});

module.exports = router;
