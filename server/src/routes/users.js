'use strict';

/**
 * 用户路由 /api/users/*（architecture.md §6.2）。
 * 关注/取关在 routes/follows.js，同挂载于 /api/users。
 */
const express = require('express');
const db = require('../db');
const { AppError, CODE, ok } = require('../utils/response');
const { authRequired, authOptional } = require('../middleware/auth');
const { parseId, parsePagination, optionalString } = require('../middleware/validate');
const { toUser, buildPostViews, POST_SELECT } = require('../services/views');

const router = express.Router();

const findUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const countPosts = db.prepare('SELECT COUNT(*) AS n FROM posts WHERE author_id = ?');
const countFollowers = db.prepare('SELECT COUNT(*) AS n FROM follows WHERE following_id = ?');
const countFollowing = db.prepare('SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?');
const findFollow = db.prepare(
  'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?'
);

function requireUser(id) {
  const user = findUserById.get(id);
  if (!user) throw new AppError(CODE.NOT_FOUND, '用户不存在');
  return user;
}

// GET /api/users/:id —— 用户详情 + 统计 + 是否已关注（可选鉴权）
router.get('/:id', authOptional, (req, res) => {
  const id = parseId(req.params.id);
  const user = requireUser(id);
  const stats = {
    postCount: countPosts.get(id).n,
    followerCount: countFollowers.get(id).n,
    followingCount: countFollowing.get(id).n,
  };
  const followed = req.user ? !!findFollow.get(req.user.uid, id) : false;
  return ok(res, { user: toUser(user), stats, followed });
});

// GET /api/users/:id/posts —— 用户帖子列表（分页）
router.get('/:id/posts', authOptional, (req, res) => {
  const id = parseId(req.params.id);
  requireUser(id);
  const { page, pageSize, offset } = parsePagination(req.query);
  const total = countPosts.get(id).n;
  const rows = db
    .prepare(
      `${POST_SELECT} WHERE p.author_id = ?
       ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`
    )
    .all(id, pageSize, offset);
  const list = buildPostViews(db, rows, req.user?.uid ?? null);
  return ok(res, {
    list,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// 关注者 / 关注中列表（分页，返回用户列表）
function listRelations(req, res, { column, key }) {
  const id = parseId(req.params.id);
  requireUser(id);
  const { page, pageSize, offset } = parsePagination(req.query);
  const total =
    key === 'followers' ? countFollowers.get(id).n : countFollowing.get(id).n;
  const rows = db
    .prepare(
      `SELECT u.* FROM follows f JOIN users u ON u.id = f.${column}
        WHERE f.${key === 'followers' ? 'following_id' : 'follower_id'} = ?
        ORDER BY f.created_at DESC LIMIT ? OFFSET ?`
    )
    .all(id, pageSize, offset);
  return ok(res, {
    list: rows.map(toUser),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

// GET /api/users/:id/followers
router.get('/:id/followers', authOptional, (req, res) =>
  listRelations(req, res, { column: 'follower_id', key: 'followers' })
);

// GET /api/users/:id/following
router.get('/:id/following', authOptional, (req, res) =>
  listRelations(req, res, { column: 'following_id', key: 'following' })
);

// PUT /api/users/me —— 更新当前用户资料（仅允许白名单字段）
router.put('/me', authRequired, (req, res) => {
  const user = requireUser(req.user.uid);
  const nickname = optionalString(req.body?.nickname, 'nickname', { min: 1, max: 20 });
  const avatar = optionalString(req.body?.avatar, 'avatar', { max: 500 });
  const bio = optionalString(req.body?.bio, 'bio', { max: 300 });

  // 列名为代码内固定字面量（白名单），值走参数化绑定，杜绝注入。
  const sets = [];
  const params = [];
  if (nickname !== undefined) {
    sets.push('nickname = ?');
    params.push(nickname);
  }
  if (avatar !== undefined) {
    sets.push('avatar = ?');
    params.push(avatar || null);
  }
  if (bio !== undefined) {
    sets.push('bio = ?');
    params.push(bio || null);
  }
  if (sets.length) {
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params, user.id);
  }
  return ok(res, { user: toUser(findUserById.get(user.id)) });
});

module.exports = router;
