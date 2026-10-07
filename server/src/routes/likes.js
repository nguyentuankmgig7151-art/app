'use strict';

/**
 * 点赞路由（挂载于 /api/posts，architecture.md §6.5）。
 * POST   /api/posts/:id/like  点赞
 * DELETE /api/posts/:id/like  取消点赞
 * 幂等：依赖 likes 表的 UNIQUE(user_id, post_id) 约束。
 */
const express = require('express');
const db = require('../db');
const { AppError, CODE, ok } = require('../utils/response');
const { authRequired } = require('../middleware/auth');
const { parseId } = require('../middleware/validate');

const router = express.Router();

const findPost = db.prepare('SELECT id FROM posts WHERE id = ?');
const countLikes = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?');
const insertLike = db.prepare('INSERT OR IGNORE INTO likes (user_id, post_id) VALUES (?, ?)');
const deleteLike = db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?');

function resolvePostId(req) {
  const id = parseId(req.params.id);
  if (!findPost.get(id)) throw new AppError(CODE.NOT_FOUND, '帖子不存在');
  return id;
}

router.post('/:id/like', authRequired, (req, res) => {
  const postId = resolvePostId(req);
  insertLike.run(req.user.uid, postId); // 重复点赞不报错
  return ok(res, { liked: true, likeCount: countLikes.get(postId).n });
});

router.delete('/:id/like', authRequired, (req, res) => {
  const postId = resolvePostId(req);
  deleteLike.run(req.user.uid, postId); // 未点赞时删除 0 行，同样幂等
  return ok(res, { liked: false, likeCount: countLikes.get(postId).n });
});

module.exports = router;
