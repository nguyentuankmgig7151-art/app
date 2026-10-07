'use strict';

/**
 * 关注路由（挂载于 /api/users，architecture.md §6.2）。
 * POST   /api/users/:id/follow  关注
 * DELETE /api/users/:id/follow  取关
 * 均为幂等；自关注返回 3002；目标不存在返回 4001。
 */
const express = require('express');
const db = require('../db');
const { AppError, CODE, ok } = require('../utils/response');
const { authRequired } = require('../middleware/auth');
const { parseId } = require('../middleware/validate');

const router = express.Router();

const findUserById = db.prepare('SELECT id FROM users WHERE id = ?');
const countFollowers = db.prepare('SELECT COUNT(*) AS n FROM follows WHERE following_id = ?');
const insertFollow = db.prepare(
  'INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)'
);
const deleteFollow = db.prepare(
  'DELETE FROM follows WHERE follower_id = ? AND following_id = ?'
);

function resolveTarget(req) {
  const id = parseId(req.params.id);
  if (id === req.user.uid) throw new AppError(CODE.SELF_FOLLOW, '不能关注自己');
  if (!findUserById.get(id)) throw new AppError(CODE.NOT_FOUND, '用户不存在');
  return id;
}

router.post('/:id/follow', authRequired, (req, res) => {
  const targetId = resolveTarget(req);
  insertFollow.run(req.user.uid, targetId); // OR IGNORE 保证重复关注幂等
  return ok(res, { followed: true, followerCount: countFollowers.get(targetId).n });
});

router.delete('/:id/follow', authRequired, (req, res) => {
  const targetId = resolveTarget(req);
  deleteFollow.run(req.user.uid, targetId); // 未关注时删除 0 行，同样幂等
  return ok(res, { followed: false, followerCount: countFollowers.get(targetId).n });
});

module.exports = router;
