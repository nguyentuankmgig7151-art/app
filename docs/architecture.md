# 社区网站 · 技术方案与接口契约

> 版本：v1.0（冻结基线，后续 `server/` 与 `web/` 编码必须严格遵守本文契约）
> 范围：标准版 —— 发帖、评论、点赞、关注、用户中心、标签分类、搜索
> 架构：前后端分离（React SPA + Node.js/Express REST API + SQLite）

---

## 1. 技术选型

### 1.1 结论

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 前端 | **Vite + React 18 + React Router v6** | 推荐方案（见下方理由） |
| 前端请求 | `fetch` 封装（`web/src/api/http.js`） | 轻量、零额外依赖 |
| 状态 | React Context（AuthContext） | 仅需登录态，无需 Redux |
| 后端 | **Node.js + Express 4** | 需求建议方案 |
| 数据库 | **better-sqlite3** | 同步 API、零外部依赖、开箱即跑 |
| 鉴权 | **JWT（jsonwebtoken）**，HS256 | 密钥走环境变量 |
| 密码 | **bcrypt**（bcryptjs 可选） | 严禁明文/MD5/SHA1 |
| 校验 | zod 或 express-validator | 统一在路由层校验入参 |
| 跨域 | `cors` 中间件 + Vite dev proxy | 见 §3 |

### 1.2 前端框架推荐理由

**推荐 Vite + React + React Router（SPA），不推荐 Next.js。**

1. 需求为标准版社区功能，无 SEO 强诉求、无 SSR 诉求；帖子详情页对搜索引擎收录不是硬性指标。
2. SPA 架构与「前后端分离 REST API」契约最贴合：前端只消费 `/api/*`，边界清晰，便于后端独立测试。
3. 零服务端渲染复杂度，`npm run dev` 启动即用，降低「开箱即跑」的交付风险。
4. 若后续确有 SSR/SEO 需要，可平滑迁移到 Next.js（App Router），API 契约不变。

> 备选：若产品明确要求 SEO 与首屏直出，可用 Next.js；但本文档以 **Vite SPA** 为基线冻结。

### 1.3 运行方式

- 需求要求 `npm install && npm run dev` 一键启动完整项目。
- 采用 **根目录 npm workspaces**：根 `package.json` 的 `dev` 脚本通过 `concurrently` 同时拉起 server 与 web。
- 根脚本约定：
  - `npm run dev`     → 并行启动后端(3001) + 前端(5173)
  - `npm run dev:server` → 仅后端
  - `npm run dev:web`    → 仅前端
  - `npm run seed`       → 初始化种子数据（可选）

---

## 2. 目录结构约定

```
.
├── package.json              # 根：workspaces + concurrently 脚本
├── README.md                 # 启动说明
├── .env.example              # 环境变量样例（真实值放 .env，禁止提交）
├── docs/
│   └── architecture.md       # 本文档
├── server/                   # 后端
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js          # Express 入口、CORS、路由挂载
│       ├── db/
│       │   ├── index.js      # better-sqlite3 连接（单例）
│       │   └── schema.sql    # 建表 SQL（见 §4）
│       ├── middleware/
│       │   ├── auth.js       # JWT 解析/校验（authRequired / authOptional）
│       │   ├── validate.js   # 入参校验
│       │   └── error.js      # 统一错误处理
│       ├── routes/
│       │   ├── auth.js       # /api/auth/*
│       │   ├── users.js      # /api/users/*
│       │   ├── posts.js      # /api/posts/*
│       │   ├── comments.js   # /api/comments/*, /api/posts/:id/comments
│       │   ├── likes.js      # 点赞
│       │   ├── follows.js    # 关注
│       │   ├── tags.js       # /api/tags
│       │   └── search.js     # /api/search
│       ├── services/         # 业务逻辑（可选分层）
│       └── utils/
│           ├── response.js   # ok()/fail() 统一响应
│           └── password.js   # bcrypt 封装
└── web/                      # 前端
    ├── package.json
    ├── vite.config.js        # dev proxy /api -> http://localhost:3001
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx           # 路由表（见 §7）
        ├── api/
        │   ├── http.js       # fetch 封装：注入 token、统一解包
        │   └── endpoints.js  # 各接口调用函数
        ├── context/AuthContext.jsx
        ├── components/       # 通用组件（Navbar、PostCard、CommentList…）
        └── pages/            # 页面组件（见 §7）
```

---

## 3. 端口与跨域（CORS）方案

| 服务 | 端口 | 地址 |
| --- | --- | --- |
| 后端 API | **3001** | `http://localhost:3001` |
| 前端开发服务器 | **5173** | `http://localhost:5173` |

**CORS 策略（两种并存，保证开箱即用）：**

1. **后端启用 `cors` 中间件**
   - 允许来源从环境变量 `CORS_ORIGIN` 读取，默认 `http://localhost:5173`。
   - 生产/联调如需携带凭据：`credentials: true`。
   - 允许方法：`GET, POST, PUT, DELETE, OPTIONS`；允许头：`Content-Type, Authorization`。
2. **前端 Vite dev proxy（首选，彻底规避跨域）**
   - `web/vite.config.js` 配置：
     ```js
     server: {
       port: 5173,
       proxy: {
         '/api': { target: 'http://localhost:3001', changeOrigin: true }
       }
     }
     ```
   - 前端所有请求走**相对路径** `/api/...`，开发环境由 Vite 代理到后端；生产可由 Nginx 反代 `/api` 到后端。
   - 因此前端 API base 统一为 `''`（空），仅保留 `VITE_API_BASE` 环境变量覆盖能力（默认空字符串）。

---

## 4. 数据模型与建表 SQL

数据库文件：`server/data/community.db`（首次启动自动创建并执行 `schema.sql`）。
统一启用 `PRAGMA foreign_keys = ON;` 与 `PRAGMA journal_mode = WAL;`。

### 4.1 表设计总览

| 表 | 用途 | 主键 | 主要外键 |
| --- | --- | --- | --- |
| `users` | 用户 | `id` | — |
| `posts` | 帖子 | `id` | `author_id → users.id` |
| `comments` | 评论 | `id` | `post_id → posts.id`, `author_id → users.id` |
| `likes` | 点赞（用户×帖子，唯一） | `id` | `user_id → users.id`, `post_id → posts.id` |
| `follows` | 关注（关注者×被关注者，唯一） | `id` | `follower_id → users.id`, `following_id → users.id` |
| `tags` | 标签 | `id` | — |
| `post_tags` | 帖子-标签关联（多对多，联合唯一） | `(post_id, tag_id)` | `post_id → posts.id`, `tag_id → tags.id` |

### 4.2 建表 SQL（`server/src/db/schema.sql`）

```sql
-- 统一设置
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
```

### 4.3 字段与约束说明

- 所有时间字段以 UTC 文本（`YYYY-MM-DD HH:MM:SS`）存储，接口返回时按 ISO 字符串或原样返回，前端自行格式化。
- `users.username` 与 `tags.name` 唯一；`likes(user_id, post_id)`、`follows(follower_id, following_id)` 联合唯一，保证幂等。
- 帖子/评论删除采用 `ON DELETE CASCADE`：删帖级联删除其评论、点赞、标签关联。
- 全库外键一致性由 `PRAGMA foreign_keys = ON` 强制。

### 4.4 密码存储要求（强约束）

- 注册时使用 **bcrypt** 哈希，`cost = 10`；示例：
  ```js
  const hash = bcrypt.hashSync(password, 10);
  const ok = bcrypt.compareSync(password, user.password_hash);
  ```
- **禁止**：明文存储、MD5、SHA1、SHA256 裸哈希。密码字段仅以 `password_hash` 形式存在。
- 任何接口响应中**不得**返回 `password_hash` 字段。

---

## 5. 统一响应格式与错误码

### 5.1 统一响应体

所有接口（成功/失败）统一返回 JSON：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

- `code`：`0` 表示业务成功；非 0 为业务错误码（见 §5.3）。
- `message`：人类可读信息，成功固定 `"ok"`。
- `data`：成功时的数据体；失败时为 `null`。
- HTTP 状态码与业务码配合：鉴权失败用 401、无权限 403、未找到 404、参数错误 400、成功 200/201。

### 5.2 成功示例

```json
{ "code": 0, "message": "ok", "data": { "id": 12, "title": "..." } }
```

### 5.3 错误码约定

| code | HTTP | 含义 | 触发场景 |
| --- | --- | --- | --- |
| 0 | 200/201 | 成功 | — |
| 1001 | 400 | 参数校验失败 | 缺字段、类型错误、越界 |
| 1002 | 400 | 用户名已存在 | 注册重复 |
| 1003 | 400 | 用户名或密码错误 | 登录失败 |
| 1004 | 400 | 标签数量/格式不合法 | 帖子标签校验 |
| 2001 | 401 | 未登录 / token 缺失 | 需要鉴权的接口 |
| 2002 | 401 | token 无效或已过期 | JWT 校验失败 |
| 3001 | 403 | 无权限操作该资源 | 改/删他人帖子、评论 |
| 3002 | 400 | 不能关注自己 | 自关注 |
| 4001 | 404 | 资源不存在 | 帖子/用户/评论不存在 |
| 5000 | 500 | 服务器内部错误 | 未捕获异常 |

错误响应示例：

```json
{ "code": 1001, "message": "title 不能为空", "data": null }
```

### 5.4 分页约定

列表类接口统一使用查询参数并返回分页元信息：

- 请求：`?page=1&pageSize=10`（`page` 默认 1，`pageSize` 默认 10，最大 50）
- 响应 `data`：
  ```json
  {
    "list": [],
    "pagination": { "page": 1, "pageSize": 10, "total": 128, "totalPages": 13 }
  }
  ```

---

## 6. REST API 契约

- Base URL：`/api`
- 请求/响应均为 `application/json; charset=utf-8`
- 鉴权方式：`Authorization: Bearer <JWT>`（`authRequired`）
- 「可选鉴权」（`authOptional`）：未带 token 也能访问，带 token 时额外返回 `liked`、`followed` 等个性化字段。
- 用户对象统一视图（对外）：
  ```json
  { "id": 1, "username": "alice", "nickname": "Alice", "avatar": null, "bio": null, "createdAt": "2024-01-01 00:00:00" }
  ```
- 帖子对象统一视图（对外）：
  ```json
  {
    "id": 10, "title": "...", "content": "...",
    "createdAt": "...", "updatedAt": "...",
    "author": { "id": 1, "username": "alice", "nickname": "Alice", "avatar": null },
    "tags": ["javascript", "react"],
    "likeCount": 3, "commentCount": 5,
    "liked": false
  }
  ```

### 6.1 认证 Auth

| 方法 | 路径 | 鉴权 | 请求体 | 响应 data |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | 否 | `{ username, password, nickname? }` | `{ token, user }` |
| POST | `/api/auth/login` | 否 | `{ username, password }` | `{ token, user }` |
| GET | `/api/auth/me` | 是 | — | `{ user }` |

校验规则：
- `username`：3–20 字符，仅 `[A-Za-z0-9_]`，唯一。
- `password`：6–64 字符。
- `nickname`：可选，1–20 字符，默认等于 `username`。

注册成功返回 HTTP 201。`token` 由 `jsonwebtoken` 以 `JWT_SECRET` 签发，payload `{ uid, username }`，过期 `7d`。

### 6.2 用户 Users

| 方法 | 路径 | 鉴权 | 请求体 | 响应 data |
| --- | --- | --- | --- | --- |
| GET | `/api/users/:id` | 可选 | — | `{ user, stats: { postCount, followerCount, followingCount }, followed }` |
| GET | `/api/users/:id/posts` | 可选 | query: `page,pageSize` | `{ list, pagination }` |
| GET | `/api/users/:id/followers` | 可选 | query: `page,pageSize` | `{ list, pagination }`（用户列表） |
| GET | `/api/users/:id/following` | 可选 | query: `page,pageSize` | `{ list, pagination }`（用户列表） |
| PUT | `/api/users/me` | 是 | `{ nickname?, avatar?, bio? }` | `{ user }` |
| POST | `/api/users/:id/follow` | 是 | — | `{ followed: true, followerCount }` |
| DELETE | `/api/users/:id/follow` | 是 | — | `{ followed: false, followerCount }` |

- 关注操作幂等：重复关注返回成功但不重复插入（依赖 `UNIQUE`）。
- 自关注返回 `code 3002`。
- 关注不存在的用户返回 `code 4001`。

### 6.3 帖子 Posts

| 方法 | 路径 | 鉴权 | 请求体 / 查询 | 响应 data |
| --- | --- | --- | --- | --- |
| GET | `/api/posts` | 可选 | query: `page, pageSize, tag, q, authorId, sort` | `{ list, pagination }` |
| POST | `/api/posts` | 是 | `{ title, content, tags?: string[] }` | `{ post }` |
| GET | `/api/posts/:id` | 可选 | — | `{ post }` |
| PUT | `/api/posts/:id` | 是 | `{ title?, content?, tags?: string[] }` | `{ post }` |
| DELETE | `/api/posts/:id` | 是 | — | `{ id }` |

列表查询语义：
- `tag`：按标签名过滤（联表 `post_tags` + `tags`）。
- `q`：对 `title`/`content` 做模糊匹配（`LIKE '%q%'`，使用参数化绑定）。
- `authorId`：按作者过滤（用于用户主页帖子）。
- `sort`：`latest`（默认，`created_at DESC`）| `hot`（`likeCount + commentCount DESC`，可选实现）。
- 分页返回 `list` 与 `pagination`。

校验规则：
- `title`：1–100 字符；`content`：1–10000 字符。
- `tags`：可选数组，元素 1–20 字符，最多 5 个；写入时不存在则创建，并写入 `post_tags`。

权限：仅作者可 `PUT`/`DELETE`，否则 `code 3001`。

### 6.4 评论 Comments

| 方法 | 路径 | 鉴权 | 请求体 | 响应 data |
| --- | --- | --- | --- | --- |
| GET | `/api/posts/:id/comments` | 可选 | query: `page,pageSize` | `{ list, pagination }` |
| POST | `/api/posts/:id/comments` | 是 | `{ content }` | `{ comment }` |
| DELETE | `/api/comments/:id` | 是 | — | `{ id }` |

- 评论对象：`{ id, postId, content, createdAt, author: {...} }`。
- `content`：1–500 字符。
- 删除权限：评论作者 **或** 帖子作者 均可删除，否则 `code 3001`。

### 6.5 点赞 Likes

| 方法 | 路径 | 鉴权 | 请求体 | 响应 data |
| --- | --- | --- | --- | --- |
| POST | `/api/posts/:id/like` | 是 | — | `{ liked: true, likeCount }` |
| DELETE | `/api/posts/:id/like` | 是 | — | `{ liked: false, likeCount }` |

- 点赞幂等：重复点赞不报错，返回当前状态与计数。
- 取消未点赞的帖子同样幂等返回成功。

### 6.6 标签 Tags

| 方法 | 路径 | 鉴权 | 查询 | 响应 data |
| --- | --- | --- | --- | --- |
| GET | `/api/tags` | 否 | query: `limit?`（默认 50） | `{ list: [{ id, name, postCount }] }` |
| GET | `/api/tags/:name/posts` | 可选 | query: `page,pageSize` | `{ list, pagination, tag }` |

### 6.7 搜索 Search

| 方法 | 路径 | 鉴权 | 查询 | 响应 data |
| --- | --- | --- | --- | --- |
| GET | `/api/search` | 可选 | query: `q`（必填）, `type`（`post`默认）`user`, `page, pageSize` | `{ list, pagination, q, type }` |

- `type=post`：模糊匹配帖子 `title`/`content`。
- `type=user`：模糊匹配用户 `username`/`nickname`。
- `q` 为空时返回 `code 1001`。
- 所有查询必须使用 better-sqlite3 的**参数化语句**（`db.prepare(...).all(params)`），禁止字符串拼接。

### 6.8 接口一览（速查）

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
GET    /api/users/:id
GET    /api/users/:id/posts
GET    /api/users/:id/followers
GET    /api/users/:id/following
PUT    /api/users/me
POST   /api/users/:id/follow
DELETE /api/users/:id/follow
GET    /api/posts
POST   /api/posts
GET    /api/posts/:id
PUT    /api/posts/:id
DELETE /api/posts/:id
GET    /api/posts/:id/comments
POST   /api/posts/:id/comments
DELETE /api/comments/:id
POST   /api/posts/:id/like
DELETE /api/posts/:id/like
GET    /api/tags
GET    /api/tags/:name/posts
GET    /api/search
```

---

## 7. 前端路由与页面清单

路由库：React Router v6（`createBrowserRouter`）。

| 路径 | 页面组件 | 说明 | 是否需要登录 |
| --- | --- | --- | --- |
| `/` | `HomePage` | 首页/帖子列表（分页、排序、标签入口） | 否 |
| `/posts/:id` | `PostDetailPage` | 帖子详情 + 评论列表 + 点赞/评论操作 | 否（交互需登录） |
| `/new` | `PostEditorPage` | 发帖（标题/正文/标签） | 是 |
| `/posts/:id/edit` | `PostEditorPage` | 编辑帖子（复用编辑页，可选） | 是 |
| `/login` | `LoginPage` | 登录 | 否 |
| `/register` | `RegisterPage` | 注册 | 否 |
| `/users/:id` | `UserProfilePage` | 用户中心（资料、帖子、粉丝/关注） | 否 |
| `/me` | `UserProfilePage` | 当前用户中心（重定向到 `/users/:myId`） | 是 |
| `/search` | `SearchPage` | 搜索页（帖子/用户，`?q=&type=`） | 否 |
| `/tags` | `TagsPage` | 标签总览 | 否 |
| `/tags/:name` | `TagPostsPage` | 某标签下帖子列表 | 否 |
| `*` | `NotFoundPage` | 404 | 否 |

**页面/组件职责：**

- `HomePage`：调用 `GET /api/posts`，展示 `PostCard` 列表 + 分页器；支持点击标签跳转 `/tags/:name`。
- `PostDetailPage`：`GET /api/posts/:id` + `GET /api/posts/:id/comments`；登录后可点赞、评论；作者可删除。
- `PostEditorPage`：`POST /api/posts` 或 `PUT /api/posts/:id`；标签以逗号/回车输入转为数组。
- `LoginPage` / `RegisterPage`：成功后写入 token 到 `localStorage`，更新 `AuthContext`，跳转首页。
- `UserProfilePage`：`GET /api/users/:id` + `/posts` + `/followers` + `/following`；登录用户可关注/取关。
- `SearchPage`：`GET /api/search?q=&type=`，支持帖子/用户切换。
- `TagsPage` / `TagPostsPage`：`GET /api/tags`、`GET /api/tags/:name/posts`。

**登录态处理：**

- `AuthContext` 启动时读取 `localStorage.token`，调用 `GET /api/auth/me` 恢复用户。
- `ProtectedRoute` 包裹需登录页面，未登录重定向 `/login`。
- `http.js` 请求拦截：自动附加 `Authorization: Bearer <token>`；响应 `code 2001/2002` 时清除 token 并跳转登录。

---

## 8. 安全要求（强约束）

1. **输入校验**：所有写接口在路由层校验入参（长度、类型、必填、数组元素），不合法返回 `code 1001` 与明确 message。搜索结果 `q`、分页参数同样校验。
2. **参数化 SQL 防注入**：数据库访问一律使用 better-sqlite3 预处理语句（`db.prepare(...).run/get/all(params)`）。**严禁**任何形式的字符串拼接 SQL，包括 `LIKE` 通配、`ORDER BY` 动态列（如需动态排序，白名单映射到固定字面量）。
3. **密码安全**：bcrypt 哈希（cost≥10），禁止明文/MD5/SHA1；响应永不包含 `password_hash`。
4. **敏感信息走环境变量**：
   - `JWT_SECRET`：签发/校验密钥，禁止硬编码；缺失时启动报错。
   - `PORT`（默认 3001）、`DB_PATH`、`CORS_ORIGIN`。
   - `.env` 不提交（已在 `.gitignore` 忽略），提供 `.env.example`。
5. **资源权限**：改/删帖子仅作者；删评论仅评论作者或帖子作者；越权返回 `code 3001`。
6. **JWT 校验**：`authRequired` 中间件校验 `Authorization` 头与签名、过期时间；失败返回 401。
7. **错误处理**：统一错误中间件捕获异常，返回 `code 5000`，不在响应中泄露堆栈/SQL 细节。

### 8.1 环境变量清单

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | 后端端口 |
| `JWT_SECRET` | 无（必填） | JWT 签名密钥 |
| `JWT_EXPIRES_IN` | `7d` | token 有效期 |
| `DB_PATH` | `server/data/community.db` | SQLite 文件路径 |
| `CORS_ORIGIN` | `http://localhost:5173` | 允许的前端来源 |
| `VITE_API_BASE` | `''`（空） | 前端 API 基址，空则由 Vite 代理 |

---

## 9. 交付与验收标准

1. 根目录执行 `npm install && npm run dev` 可同时启动后端(3001)与前端(5173)，浏览器访问 `http://localhost:5173` 正常。
2. `README.md` 含：环境要求（Node ≥ 18）、安装、启动、环境变量配置、接口 Base URL、可选 seed 说明。
3. 覆盖需求全部功能：发帖、评论、点赞、关注、用户中心、标签分类、搜索。
4. 数据库首次启动自动建表（执行 `schema.sql`），无外部依赖。
5. 所有接口符合本文 §5（响应格式）与 §6（契约）约定；编码阶段不得擅自更名路径或字段。
6. 安全约束 §8 全部满足；密钥来自环境变量。

---

## 10. 后续编码任务分工依赖

- **后端任务（server/）**：严格实现 §4 数据模型与 §6 REST 契约，产出 `schema.sql` 与各路由。
- **前端任务（web/）**：按 §7 路由清单与 §6 契约对接，统一通过 `http.js` 消费 `/api/*`。
- 两端共同遵守 §5 响应格式与 §8 安全要求。
