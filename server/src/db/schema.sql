-- 社区网站数据库结构（与 docs/architecture.md §4 保持一致，冻结契约）
-- 首次启动由 src/db/index.js 自动执行本文件。
-- 统一设置：开启外键约束、WAL 日志模式。
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 用户
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,            -- 登录名，唯一
  password_hash TEXT    NOT NULL,                   -- bcrypt 哈希，严禁明文/MD5/SHA1
  nickname      TEXT    NOT NULL,                   -- 展示昵称
  avatar        TEXT,                               -- 头像 URL，可空
  bio           TEXT,                               -- 个人简介，可空
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 帖子
CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id  INTEGER NOT NULL,
  title      TEXT    NOT NULL,
  content    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_posts_author     ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- 评论
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL,
  author_id  INTEGER NOT NULL,
  content    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (post_id)   REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_comments_post   ON comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);

-- 点赞（同一用户对同一帖子仅一次）
CREATE TABLE IF NOT EXISTS likes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  post_id    INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);

-- 关注（follower 关注 following；同一对关系唯一，禁止自关注由应用层校验）
CREATE TABLE IF NOT EXISTS follows (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id  INTEGER NOT NULL,
  following_id INTEGER NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id),
  FOREIGN KEY (follower_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);

-- 标签
CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,               -- 标签名，唯一
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 帖子-标签关联（多对多）
CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
