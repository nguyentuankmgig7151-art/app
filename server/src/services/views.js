'use strict';

/**
 * 对外视图序列化（architecture.md §6 的「统一对象视图」）。
 * 为什么单独抽出：帖子列表/详情/搜索等多处需要相同结构，集中一处避免字段漂移，
 * 并保证永不返回 password_hash。
 */

/** 用户对外视图 */
function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatar: row.avatar ?? null,
    bio: row.bio ?? null,
    createdAt: row.created_at,
  };
}

/** 帖子基础字段（不含 tags/liked，由 buildPostViews 补齐） */
function toPostBase(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.author_id,
      username: row.username,
      nickname: row.nickname,
      avatar: row.avatar ?? null,
    },
    tags: [],
    likeCount: row.likeCount ?? 0,
    commentCount: row.commentCount ?? 0,
    liked: false,
  };
}

/**
 * 批量把帖子行转换为视图，一次性补齐 tags 与当前用户的 liked 状态，
 * 避免列表页 N+1 查询。
 * @param {import('better-sqlite3').Database} db
 * @param {object[]} rows 已 JOIN 作者并含 likeCount/commentCount 的帖子行
 * @param {number|null} currentUid 当前登录用户 id（可选鉴权）
 */
function buildPostViews(db, rows, currentUid = null) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  // 一次查出所有相关标签
  const tagRows = db
    .prepare(
      `SELECT pt.post_id AS postId, t.name AS name
         FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id IN (${placeholders})
        ORDER BY t.name ASC`
    )
    .all(...ids);
  const tagsByPost = new Map();
  for (const t of tagRows) {
    if (!tagsByPost.has(t.postId)) tagsByPost.set(t.postId, []);
    tagsByPost.get(t.postId).push(t.name);
  }

  // 一次查出当前用户点赞过的帖子
  const likedSet = new Set();
  if (currentUid) {
    const likedRows = db
      .prepare(
        `SELECT post_id AS postId FROM likes
          WHERE user_id = ? AND post_id IN (${placeholders})`
      )
      .all(currentUid, ...ids);
    for (const r of likedRows) likedSet.add(r.postId);
  }

  return rows.map((row) => {
    const post = toPostBase(row);
    post.tags = tagsByPost.get(row.id) || [];
    post.liked = likedSet.has(row.id);
    return post;
  });
}

/** 单帖查询 SQL 片段：JOIN 作者并带点赞/评论计数（供列表与详情复用） */
const POST_SELECT = `
  SELECT p.*,
         u.username, u.nickname, u.avatar,
         (SELECT COUNT(*) FROM likes l    WHERE l.post_id = p.id) AS likeCount,
         (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount
    FROM posts p JOIN users u ON u.id = p.author_id`;

module.exports = { toUser, toPostBase, buildPostViews, POST_SELECT };
