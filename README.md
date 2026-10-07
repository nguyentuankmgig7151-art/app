# 城市人文旅行（City Humanities Travel）

以世界知名人文城市为线索的目的地展示站点，支持**目的地浏览 / 关键词搜索 / 标签筛选 / 留言 / 预订意向提交**。

- 架构：前后端分离（React SPA + Node.js / Express REST API + 本地 JSON 文件持久化，**不引入数据库**）。
- 契约依据：`docs/SPEC.md`（数据字段、接口路径、响应结构以该文档为准）。

> 当前阶段已实现**根工程配置 + 后端 API**；前端（`frontend/`）将随后续任务补充。

---

## 目录结构

```
.
├── package.json          # 根：npm workspaces + 一键脚本
├── README.md
├── .gitignore
├── docs/SPEC.md          # 实施方案（唯一执行依据）
└── backend/              # Express + JSON 文件持久化
    ├── package.json
    ├── .env.example
    ├── data/
    │   ├── destinations.json        # 运行时数据（首次由 seed 生成）
    │   ├── messages.json
    │   ├── bookings.json
    │   └── seed/                    # 只读种子数据
    │       ├── destinations.seed.json
    │       ├── messages.seed.json
    │       └── bookings.seed.json
    └── src/
        ├── app.js                  # 组装 Express 应用
        ├── server.js               # 入口：初始化数据 + 监听端口
        ├── config.js               # 读取环境变量
        ├── store/                  # jsonStore（原子写 + 写队列）、collections
        ├── middleware/             # validate / error / requestId
        ├── routes/                 # destinations / messages / bookings
        └── utils/                  # response / id
```

---

## 环境要求

- Node.js **≥ 18**（使用 `crypto.randomUUID()`、ESM、`node:test`）。
- npm（随 Node 附带）。

---

## 启动说明

### 1. 安装依赖（在仓库根目录执行）

```bash
npm install
```

根使用 npm workspaces，会同时安装 `backend`（以及后续 `frontend`）的依赖。

### 2. 配置环境变量（可选）

```bash
cp backend/.env.example backend/.env
```

默认值即可本地开发：`PORT=3001`、`CORS_ORIGIN=http://localhost:5173`。真实 `.env` 不会提交（见 `.gitignore`）。

### 3. 启动

```bash
# 仅启动后端（当前可用）
npm run dev:backend

# 一键并行启动前后端（前端就绪后可用）
npm run dev

# 生产模式启动后端
npm start
```

后端启动后监听 `http://localhost:3001`，健康检查：

```bash
curl http://localhost:3001/api/health
# {"success":true,"data":{"status":"ok","time":"..."}}
```

### 4. 重置种子数据

```bash
npm run seed
```

将 `backend/data/` 下的运行时文件（`destinations.json` / `messages.json` / `bookings.json`）重置为 `backend/data/seed/` 中的种子内容。

---

## API 一览（Base：`/api`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/destinations` | 目的地列表（`?q=` 搜索、`?tag=` 筛选、`?region=`、`?country=`、`?featured=`、`?sort=`、`?limit=`、`?offset=`） |
| GET | `/api/destinations/:id` | 目的地详情 |
| POST | `/api/destinations` | 新增目的地（管理用途） |
| DELETE | `/api/destinations/:id` | 删除目的地（级联删除其留言） |
| GET | `/api/destinations/:id/messages` | 某目的地的留言列表 |
| POST | `/api/messages` | 提交留言 |
| DELETE | `/api/messages/:id` | 删除留言 |
| GET | `/api/bookings` | 预订列表（管理用途） |
| POST | `/api/bookings` | 提交预订意向 |

统一响应包装：

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

错误码：`VALIDATION_ERROR`(400)、`NOT_FOUND`(404)、`ROUTE_NOT_FOUND`(404)、`INTERNAL_ERROR`(500)。

### 快速体验

```bash
# 列表 + 搜索
curl "http://localhost:3001/api/destinations?q=京都"
curl "http://localhost:3001/api/destinations?tag=古寺&sort=rating"

# 详情
curl "http://localhost:3001/api/destinations/seed-kyoto"

# 提交留言
curl -X POST http://localhost:3001/api/messages \
  -H 'Content-Type: application/json' \
  -d '{"destinationId":"seed-kyoto","author":"小林","content":"祇园的黄昏太美了。","rating":5}'

# 提交预订意向
curl -X POST http://localhost:3001/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"destinationId":"seed-kyoto","name":"王旅","email":"wang@example.com","travelDate":"2024-04-15","guests":2}'
```

---

## 可靠性设计

- **原子写**：先写 `xxx.json.tmp`，再 `fs.rename` 覆盖目标文件，避免半写损坏。
- **写队列串行化**：同一文件的并发写通过 Promise 队列串行执行，避免交叉覆盖。
- **首次启动播种**：`data/` 下文件不存在时，自动从 `data/seed/` 复制生成。
- **统一 id / 时间戳**：新增记录由服务端注入 `crypto.randomUUID()` 与 ISO 时间。

---

## 安全约定

- 不硬编码任何密钥 / Token / 真实邮箱 / 真实电话。
- `.env` 不提交；提供 `.env.example` 作为样例。
- 留言接口响应**不回显 `email`**（隐私保护）。

---

## 明确不做（Out of Scope）

用户注册登录 / 鉴权、在线支付、数据库与 ORM、SSR / SEO 预渲染。
