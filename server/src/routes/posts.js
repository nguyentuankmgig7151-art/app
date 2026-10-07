'use strict';

/**
 * 帖子路由 /api/posts/*（architecture.md §6.3）。
 * 列表支持分页、按标签、关键字、作者、排序；写操作仅作者可改删。
 */
const express = require('express');
const db = require('../db');
const { AppError, CODE, ok } = require('../utils/response');
const { authRequired, authOptional } = require('../middleware/auth');
const {
  parseId,
  parsePagination,
  requireString,
  optionalString,
  validateTags,
} = require('../middleware/validate');
const { buildPostViews, POST_SELECT } = require('../services/views');

const router = express.Router();

const findPostWithAuthor = db.prepare(`${POST_SELECT} WHERE p.id = ?`);
const insertPost = db.prepare(
  'INSERT INTO posts (author_id, title, content) VALUES (?, ?, ?)'
);
const updatePostRow = db.prepare(
  "UPDATE posts SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?"
);
const deletePostRow = db.prepare('DELETE FROM posts WHERE id = ?');
const findTagByName = db.prepare('SELECT id FROM tags WHERE name = ?');
const insertTagIgnore = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
const linkTag = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)');
const clearPostTags = db.prepare('DELETE FROM post_tags WHERE post_id = ?');

/** 转义 LIKE 通配符，避免用户输入的 % _ 被当作通配（仍走参数化绑定） */
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** 处理标签写入：不存在的标签自动创建，并建立关联 */
const saveTags = db.transaction((postId, tags) => {
  for (const name of tags) {
    insertTagIgnore.run(name);
    const tag = findTagByName.get(name);
    linkTag.run(postId, tag.id);
  }
});

function getPostRowOr404(id) {
  const row = findPostWithAuthor.get(id);
  if (!row) throw new AppError(CODE.NOT_FOUND, '帖子不存在');
  return row;
}

// GET /api/posts —— 列表（可选鉴权，用于 liked 字段）
router.get('/', authOptional, (req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query);
  const { tag, q, authorId, sort } = req.query;

  const conditions = [];
  const params = [];
  if (tag !== undefined) {
    if (typeof tag !== 'string' || !tag.trim()) {
      throw new AppError(CODE.VALIDATION, 'tag 不能为空');
    }
    conditions.push(
      `EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
                WHERE pt.post_id = p.id AND t.name = ?)`
    );
    params.push(tag.trim());
  }
  if (q !== undefined) {
    if (typeof q !== 'string' || !q.trim()) throw new AppError(CODE.VALIDATION, 'q 不能为空');
    const like = `%${escapeLike(q.trim())}%`;
    conditions.push(`(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\')`);
    params.push(like, like);
  }
  if (authorId !== undefined) {
    params.push(parseId(authorId, 'authorId'));
    conditions.push('p.author_id = ?');
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // ORDER BY 使用白名单，绝不拼接用户输入。
  const orderBy =
    sort === 'hot'
      ? 'ORDER BY (likeCount + commentCount) DESC, p.id DESC'
      : 'ORDER BY p.created_at DESC, p.id DESC';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM posts p ${where}`).get(...params).n;
  const rows = db
    .prepare(`${POST_SELECT} ${where} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);

  return ok(res, {
    list: buildPostViews(db, rows, req.user?.uid ?? null),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// POST /api/posts —— 发帖
router.post('/', authRequired, (req, res) => {
  const title = requireString(req.body?.title, 'title', { min: 1, max: 100 });
  const content = requireString(req.body?.content, 'content', { min: 1, max: 10000 });
  const tags = validateTags(req.body?.tags) || [];

  const create = db.transaction(() => {
    const info = insertPost.run(req.user.uid, title, content);
    const postId = Number(info.lastInsertRowid);
    if (tags.length) saveTags(postId, tags);
    return postId;
  });
  const postId = create();

  const row = getPostRowOr404(postId);
  return ok(res, { post: buildPostViews(db, [row], req.user.uid)[0] }, 201);
});

// GET /api/posts/:id —— 详情
router.get('/:id', authOptional, (req, res) => {
  const id = parseId(req.params.id);
  const row = getPostRowOr404(id);
  return ok(res, { post: buildPostViews(db, [row], req.user?.uid ?? null)[0] });
});

// PUT /api/posts/:id —— 编辑（仅作者）
router.put('/:id', authRequired, (req, res) => {
  const id = parseId(req.params.id);
  const existing = getPostRowOr404(id);
  if (existing.author_id !== req.user.uid) {
    throw new AppError(CODE.FORBIDDEN, '无权修改他人帖子');
  }
  const title = optionalString(req.body?.title, 'title', { min: 1, max: 100 });
  const content = optionalString(req.body?.content, 'content', { min: 1, max: 10000 });
  const tags = validateTags(req.body?.tags);

  const update = db.transaction(() => {
    updatePostRow.run(title ?? existing.title, content ?? existing.content, id);
    if (tags !== undefined) {
      clearPostTags.run(id);
      if (tags.length) saveTags(id, tags);
    }
  });
  update();

  const row = getPostRowOr404(id);
  return ok(res, { post: buildPostViews(db, [row], req.user.uid)[0] });
});

// DELETE /api/posts/:id —— 删除（仅作者，级联删除评论/点赞/标签关联）
router.delete('/:id', authRequired, (req, res) => {
  const id = parseId(req.params.id);
  const existing = getPostRowOr404(id);
  if (existing.author_id !== req.user.uid) {
    throw new AppError(CODE.FORBIDDEN, '无权删除他人帖子');
  }
  deletePostRow.run(id);
  return ok(res, { id });
});

module.exports = router;
