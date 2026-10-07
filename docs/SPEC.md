# 城市人文旅行 · 实施方案（SPEC）

> 版本：v1.0（冻结基线，供编码专家直接执行）
> 主题：**城市人文旅行**——以世界知名人文城市为线索，展示目的地、接收用户留言与预订意向。
> 架构：前后端分离（React SPA + Node.js/Express REST API + 本地 JSON 文件持久化，**不引入数据库**）。
> 目录：前端 `frontend/`，后端 `backend/`。
> 说明：本文档为唯一执行依据。字段名、接口路径、响应结构一旦确定，编码时不得擅自更名。

---

## 目录

1. [技术选型](#1-技术选型)
2. [目录结构](#2-目录结构)
3. [数据模型](#3-数据模型)
4. [API 接口清单](#4-api-接口清单)
5. [页面与路由规划](#5-页面与路由规划)
6. [视觉规范（城市人文旅行风）](#6-视觉规范城市人文旅行风)
7. [初始种子数据](#7-初始种子数据)
8. [图片占位方案与环境约定](#8-图片占位方案与环境约定)
9. [开发与验收清单](#9-开发与验收清单)

---

## 1. 技术选型

### 1.1 选型总表

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 前端构建 | **Vite 5** | 秒级冷启动，`npm run dev` 即用 |
| 前端框架 | **React 18** | 组件化，生态成熟 |
| 前端语言 | **TypeScript（推荐）** | 见 §1.2 理由 |
| 路由 | **react-router-dom v6** | 标准 SPA 路由 |
| 数据请求 | 原生 `fetch` 封装（`src/api/http.ts`） | 零额外依赖 |
| 样式 | 原生 CSS + CSS 变量（设计令牌） | 无需 Tailwind，降低配置成本 |
| 后端 | **Node.js 18+ + Express 4** | 需求优先方案 |
| 持久化 | **本地 JSON 文件**（`backend/data/*.json`） | **不引入数据库**，见 §1.3 |
| 入参校验 | 手写轻量校验中间件（`validate.ts`） | 不引第三方，保持零依赖 |
| CORS | `cors` 中间件 + Vite dev proxy | 开发期双保险 |
| 跨端脚本 | 根 `concurrently` | 一键同时拉起前后端 |

### 1.2 前端语言：推荐 **TypeScript**

**结论：采用 TypeScript。**

理由：

1. 本项目的核心资产是**数据契约**（destination / message / booking 三类对象 + REST 响应体）。用 `interface` 描述一次，前后端共享语义，字段拼写错误在编译期即暴露。
2. 目的地列表的搜索/筛选、评分渲染、预订表单校验都属于「结构化数据流」，类型能显著减少运行期 `undefined` 崩溃。
3. Vite 对 TS 开箱即用（`vite.config.ts` + `tsconfig.json`），无需额外构建链。
4. 交付给编码专家时，类型定义可直接作为实现约束，降低返工。

> 若团队明确要求 JavaScript，可退化为 `.jsx` 并在文件顶部用 JSDoc `@typedef` 描述同样字段；但**接口字段名与结构不得改变**。

**收敛建议**：`strict: true`，`noUncheckedIndexedAccess: true`；所有 API 响应类型集中定义在 `src/types.ts`。

### 1.3 后端持久化：本地 JSON 文件（为何不用数据库）

**结论：用 `backend/data/destinations.json`、`messages.json`、`bookings.json` 三个文件持久化。**

理由：

1. **零外部依赖**：SQLite（better-sqlite3）需要原生编译，在受限沙箱/无网络环境易失败；JSON 方案纯 Node 标准库即可跑。
2. **可读可审**：种子数据与用户数据是明文 JSON，便于人工核对、测试断言、Git diff。
3. **需求规模匹配**：目的地量级十位数、留言/预订为演示流量，文件读写完全够用。
4. **契约稳定**：数据形状就是 API 响应形状，无 ORM 映射心智负担。
5. **迁移友好**：`store` 模块封装了 `read/write` 接口，未来若要换 SQLite/Postgres，只需替换 store 实现，路由层不变。

**可靠性设计（必须实现）**：

- 启动时把 JSON 读入内存（`Map`/数组），读操作走内存；写操作写内存后**原子落盘**。
- 原子落盘：先写 `xxx.json.tmp`，再 `fs.renameSync` 覆盖目标文件，避免半写损坏。
- 写串行化：用一个 Promise 队列（简易互斥锁）保证并发写不交叉覆盖。
- 首次启动若文件不存在，自动从 `backend/data/seed/*.seed.json` 复制生成。
- 所有写入必须经过 `id` 生成（`crypto.randomUUID()`）与 `createdAt` 时间戳统一注入。

### 1.4 运行方式

- 根目录保留 `package.json` 使用 npm workspaces 管理 `frontend`、`backend`。
- 根脚本约定：
  - `npm run dev` → `concurrently` 并行启动 backend(3001) + frontend(5173)
  - `npm run dev:backend` → 仅后端
  - `npm run dev:frontend` → 仅前端
  - `npm run seed` → 重置数据文件为种子数据
- 前端 dev 通过 Vite proxy 将 `/api` 转发到 `http://localhost:3001`，避免开发期 CORS 问题。

---

## 2. 目录结构

> 命名契约：前端目录固定为 `frontend/`，后端固定为 `backend/`。下文出现的路径均为规范路径。

### 2.1 仓库根

```
.
├── package.json                # 根：workspaces + concurrently 脚本
├── README.md                   # 启动说明
├── .gitignore                  # 忽略 node_modules / .env / *.tmp
├── docs/
│   └── SPEC.md                 # 本文档
├── frontend/                   # 前端（React + Vite + TS）
└── backend/                    # 后端（Express + JSON 持久化）
```

### 2.2 后端 `backend/`

```
backend/
├── package.json                # type=module；deps: express, cors, morgan
├── .env.example                # PORT=3001 等样例（真实值放 .env，禁止提交）
├── data/
│   ├── destinations.json       # 运行时数据（首次由种子生成）
│   ├── messages.json
│   ├── bookings.json
│   └── seed/
│       ├── destinations.seed.json   # 初始种子数据（只读，禁止运行期修改）
│       ├── messages.seed.json
│       └── bookings.seed.json
└── src/
    ├── index.js                # Express 入口：挂载中间件、路由、监听端口
    ├── config.js               # 读取 env（PORT、DATA_DIR、CORS_ORIGIN）
    ├── store/
    │   ├── jsonStore.js        # JSON 文件读写：load/save/原子写/写队列
    │   └── collections.js      # destinations/messages/bookings 三个集合封装
    ├── middleware/
    │   ├── validate.js         # 入参校验（必填、类型、长度、枚举）
    │   ├── error.js            # 统一错误处理 + 404
    │   └── requestId.js        # 注入 req.id（可选，便于日志排查）
    ├── routes/
    │   ├── destinations.js     # /api/destinations
    │   ├── messages.js         # /api/messages
    │   └── bookings.js         # /api/bookings
    └── utils/
        ├── response.js         # ok(data) / fail(code,message) 统一响应
        └── id.js               # newId() / nowIso()
```

关键文件职责：

| 文件 | 职责 |
| --- | --- |
| `src/index.js` | 组装应用：`express.json()` → `cors()` → 路由 → error 中间件；`app.listen(PORT)` |
| `src/store/jsonStore.js` | 提供 `readCollection(name)` / `writeCollection(name, data)`；原子写 + 串行化 |
| `src/store/collections.js` | 业务级 CRUD：`listDestinations()`、`addMessage()`、`addBooking()` 等 |
| `src/middleware/validate.js` | 校验 message/booking 请求体，失败返回 400 |
| `src/utils/response.js` | 统一响应形状 `{ success, data }` / `{ success:false, error }` |

### 2.3 前端 `frontend/`

```
frontend/
├── package.json                # deps: react, react-dom, react-router-dom；dev: vite, typescript
├── index.html                  # 挂载点 #root
├── vite.config.ts              # 端口 5173 + /api 代理到 3001
├── tsconfig.json
└── src/
    ├── main.tsx                # ReactDOM.createRoot + <BrowserRouter>
    ├── App.tsx                 # 路由表 + 全局布局（Navbar/Footer）
    ├── types.ts                # Destination / Message / Booking / ApiResponse 类型
    ├── api/
    │   ├── http.ts             # fetch 封装（baseURL、错误归一）
    │   └── endpoints.ts        # getDestinations / createMessage / createBooking 等
    ├── styles/
    │   ├── tokens.css          # 设计令牌（颜色/字体/间距/圆角/阴影）
    │   └── global.css          # 全局重置、基础排版
    ├── components/
    │   ├── Navbar.tsx          # 顶部导航（含 Logo、路由链接）
    │   ├── Footer.tsx          # 页脚（联系方式、版权）
    │   ├── DestinationCard.tsx # 目的地卡片（图片、名称、标签、评分）
    │   ├── TagFilter.tsx       # 标签筛选胶囊
    │   ├── SearchBar.tsx       # 搜索输入（关键词）
    │   ├── RatingStars.tsx     # 评分星标
    │   ├── MessageForm.tsx     # 留言表单
    │   ├── BookingForm.tsx     # 预订表单
    │   ├── SmartImage.tsx      # 图片组件：加载失败降级为渐变色
    │   └── StateView.tsx       # loading / empty / error 三态占位
    ├── pages/
    │   ├── HomePage.tsx        # 首页
    │   ├── DestinationsPage.tsx# 目的地列表（搜索 + 筛选）
    │   ├── DestinationDetail.tsx# 目的地详情（含留言/预订）
    │   ├── AboutPage.tsx       # 关于/联系
    │   └── NotFoundPage.tsx    # 404
    └── hooks/
        └── useDestinations.ts  # 列表数据获取与筛选逻辑封装
```

---

## 3. 数据模型

> 所有时间字段使用 ISO 8601 字符串（`new Date().toISOString()`）。
> 所有 `id` 使用 `crypto.randomUUID()`。
> `image` 一律为**外链 URL 或空字符串**；空值时前端降级为渐变色占位（见 §8）。

### 3.1 Destination（目的地）

| 字段 | 类型 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| `id` | string | ✅ | UUID | `"b1e2..."` |
| `name` | string | ✅ | 目的地名称 | `"京都"` |
| `city` | string | ✅ | 城市名（英文/通用名，用于索引） | `"Kyoto"` |
| `country` | string | ✅ | 国家或地区 | `"日本"` |
| `region` | string | ✅ | 大区，用于筛选 | `"东亚"` |
| `tags` | string[] | ✅ | 人文标签，用于筛选 | `["古寺","茶道","和风"]` |
| `summary` | string | ✅ | 一句话简介（≤ 60 字） | `"千年古都，寺院与町屋交织的东方美学之城。"` |
| `description` | string | ✅ | 详情长文（可含换行） | `"……"` |
| `image` | string | ✅ | 主图 URL，可为空串 | `"https://images.unsplash.com/..."` |
| `gallery` | string[] | ⭕ | 详情页图集 URL 列表 | `[]` |
| `rating` | number | ✅ | 评分 0–5，一位小数 | `4.8` |
| `reviewCount` | number | ✅ | 评价数（整数） | `1280` |
| `bestSeason` | string | ⭕ | 最佳旅行季节 | `"春 / 秋"` |
| `highlights` | string[] | ⭕ | 亮点条目（详情页列表） | `["清水寺","祇园花见小路"]` |
| `coordinates` | object | ⭕ | `{ lat, lng }` | `{lat:35.01,lng:135.76}` |
| `featured` | boolean | ⭕ | 是否首页推荐 | `true` |
| `createdAt` | string | ✅ | 创建时间 | `"2024-01-01T00:00:00.000Z"` |

TypeScript 定义（`frontend/src/types.ts`）：

```ts
export interface Destination {
  id: string;
  name: string;
  city: string;
  country: string;
  region: string;
  tags: string[];
  summary: string;
  description: string;
  image: string;
  gallery?: string[];
  rating: number;
  reviewCount: number;
  bestSeason?: string;
  highlights?: string[];
  coordinates?: { lat: number; lng: number };
  featured?: boolean;
  createdAt: string;
}
```

### 3.2 Message（留言）

| 字段 | 类型 | 必填 | 说明 | 约束 |
| --- | --- | --- | --- | --- |
| `id` | string | ✅ | UUID | 服务端生成 |
| `destinationId` | string | ✅ | 关联目的地 id | 必须存在，否则 404 |
| `author` | string | ✅ | 留言人昵称 | 1–30 字符 |
| `email` | string | ⭕ | 邮箱（不公开回显） | 若填则需符合邮箱格式 |
| `content` | string | ✅ | 留言内容 | 1–500 字符 |
| `rating` | number | ⭕ | 留言附带评分 1–5 | 整数 |
| `createdAt` | string | ✅ | 创建时间 | 服务端生成 |

```ts
export interface Message {
  id: string;
  destinationId: string;
  author: string;
  email?: string;
  content: string;
  rating?: number;
  createdAt: string;
}
```

### 3.3 Booking（预订意向）

> 语义为「提交旅行预订意向」，非支付订单；不含任何支付/身份证等敏感字段。

| 字段 | 类型 | 必填 | 说明 | 约束 |
| --- | --- | --- | --- | --- |
| `id` | string | ✅ | UUID | 服务端生成 |
| `destinationId` | string | ✅ | 关联目的地 id | 必须存在 |
| `name` | string | ✅ | 预订人姓名 | 1–30 字符 |
| `email` | string | ✅ | 联系邮箱 | 邮箱格式 |
| `phone` | string | ⭕ | 联系电话 | 5–20 字符（可选） |
| `travelDate` | string | ✅ | 出行日期 | `YYYY-MM-DD` |
| `guests` | number | ✅ | 出行人数 | 1–20 整数 |
| `notes` | string | ⭕ | 备注 | ≤ 300 字符 |
| `status` | string | ✅ | 状态 | 枚举：`pending` \| `confirmed` \| `cancelled`，默认 `pending` |
| `createdAt` | string | ✅ | 创建时间 | 服务端生成 |

```ts
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  destinationId: string;
  name: string;
  email: string;
  phone?: string;
  travelDate: string;
  guests: number;
  notes?: string;
  status: BookingStatus;
  createdAt: string;
}
```

### 3.4 统一响应包装

```ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}
```

- 成功：`{ success: true, data: <T> }`
- 失败：`{ success: false, error: { code, message } }`，并配合正确的 HTTP 状态码。

---

## 4. API 接口清单

### 4.1 通用约定

- Base URL：`/api`（开发期由 Vite proxy 转发至 `http://localhost:3001`）。
- 请求体：`Content-Type: application/json`。
- 响应体：统一 `ApiResponse<T>` 包装（见 §3.4）。
- 错误码约定：

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 入参缺失/类型错误/越界 |
| 404 | `NOT_FOUND` | 目的地或资源不存在 |
| 404 | `ROUTE_NOT_FOUND` | 未知路由 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

### 4.2 接口总览

| # | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 1 | GET | `/api/destinations` | 列表，支持关键词/标签/国家/排序 |
| 2 | GET | `/api/destinations/:id` | 单个详情 |
| 3 | POST | `/api/destinations` | 新增目的地（管理用途） |
| 4 | DELETE | `/api/destinations/:id` | 删除目的地 |
| 5 | GET | `/api/destinations/:id/messages` | 某目的地的留言列表 |
| 6 | POST | `/api/messages` | 提交留言 |
| 7 | DELETE | `/api/messages/:id` | 删除留言 |
| 8 | GET | `/api/bookings` | 预订列表（管理用途） |
| 9 | POST | `/api/bookings` | 提交预订意向 |
| 10 | GET | `/api/health` | 健康检查 |

### 4.3 接口详情

#### 1) GET `/api/destinations`

查询参数（均可选）：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `q` | string | 关键词，匹配 name/city/country/summary/tags |
| `tag` | string | 按标签精确筛选（单值） |
| `region` | string | 按大区筛选 |
| `country` | string | 按国家筛选 |
| `featured` | boolean | `true` 时仅返回 `featured=true` |
| `sort` | string | `rating`（默认，评分降序）\| `newest` \| `name` |
| `limit` | number | 分页大小，默认 50，上限 100 |
| `offset` | number | 偏移，默认 0 |

响应 `200`：

```json
{
  "success": true,
  "data": {
    "total": 10,
    "items": [
      {
        "id": "b1e2...",
        "name": "京都",
        "city": "Kyoto",
        "country": "日本",
        "region": "东亚",
        "tags": ["古寺", "茶道", "和风"],
        "summary": "千年古都，寺院与町屋交织的东方美学之城。",
        "description": "……",
        "image": "https://images.unsplash.com/...",
        "rating": 4.8,
        "reviewCount": 1280,
        "featured": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

> 列表接口可省略 `description`（为体积优化，返回 `summary` 即可）；详情接口必须返回完整字段。编码时可统一返回完整对象，实现更简单——**允许实现为完整对象**，前端按需取用。

#### 2) GET `/api/destinations/:id`

- 成功 `200`：`{ success:true, data: Destination }`
- 不存在 `404`：`{ success:false, error:{ code:"NOT_FOUND", message:"目的地不存在" } }`

#### 3) POST `/api/destinations`

请求体（服务端补全 `id`/`createdAt`）：

```json
{
  "name": "布拉格",
  "city": "Prague",
  "country": "捷克",
  "region": "中欧",
  "tags": ["哥特建筑", "古堡", "文艺"],
  "summary": "百塔之城，查理大桥与老城广场的童话氛围。",
  "description": "……",
  "image": "",
  "rating": 4.7,
  "reviewCount": 0,
  "featured": false
}
```

- 成功 `201`：`{ success:true, data: Destination }`
- 校验失败 `400`：`VALIDATION_ERROR`（`name`/`city`/`country`/`summary` 必填，`rating` 0–5）

#### 4) DELETE `/api/destinations/:id`

- 成功 `200`：`{ success:true, data:{ id } }`
- 不存在 `404`：`NOT_FOUND`
- 说明：同时级联删除该目的地的留言（可选，但建议实现）。

#### 5) GET `/api/destinations/:id/messages`

- 查询参数：`limit`（默认 50）、`offset`（默认 0）
- 成功 `200`：

```json
{
  "success": true,
  "data": {
    "total": 2,
    "items": [
      {
        "id": "m1...",
        "destinationId": "b1e2...",
        "author": "小林",
        "content": "祇园的黄昏太美了，值得再去。",
        "rating": 5,
        "createdAt": "2024-02-01T10:00:00.000Z"
      }
    ]
  }
}
```

> 出于隐私，**响应中不得回显 `email`**。

#### 6) POST `/api/messages`

请求体：

```json
{
  "destinationId": "b1e2...",
  "author": "小林",
  "email": "lin@example.com",
  "content": "祇园的黄昏太美了，值得再去。",
  "rating": 5
}
```

- 成功 `201`：`{ success:true, data: Message }`（不含 `email`）
- `destinationId` 不存在 → `404 NOT_FOUND`
- 校验失败 `400`：`author` 1–30、`content` 1–500、`rating` 若存在须为 1–5 整数

#### 7) DELETE `/api/messages/:id`

- 成功 `200`：`{ success:true, data:{ id } }`
- 不存在 `404`：`NOT_FOUND`

#### 8) GET `/api/bookings`

- 成功 `200`：`{ success:true, data:{ total, items: Booking[] } }`
- 演示项目可不鉴权；若加管理后台，建议加简单 token 头（见 §9 安全提示）。

#### 9) POST `/api/bookings`

请求体：

```json
{
  "destinationId": "b1e2...",
  "name": "王旅",
  "email": "wang@example.com",
  "phone": "13800000000",
  "travelDate": "2024-04-15",
  "guests": 2,
  "notes": "希望安排英文讲解"
}
```

- 成功 `201`：`{ success:true, data: Booking }`（`status` 默认 `pending`）
- 校验失败 `400`：`name` 1–30、`email` 邮箱格式、`travelDate` 匹配 `^\d{4}-\d{2}-\d{2}$`、`guests` 1–20 整数
- `destinationId` 不存在 → `404 NOT_FOUND`

#### 10) GET `/api/health`

- 成功 `200`：`{ success:true, data:{ status:"ok", time:"<ISO>" } }`

### 4.4 前端请求封装示例（`frontend/src/api/http.ts`）

```ts
const BASE = import.meta.env.VITE_API_BASE ?? '/api';

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    const msg = body?.error?.message ?? `请求失败(${res.status})`;
    throw new Error(msg);
  }
  return body.data as T;
}
```

`frontend/src/api/endpoints.ts` 暴露：`getDestinations(params)`、`getDestination(id)`、`getMessages(id)`、`createMessage(payload)`、`createBooking(payload)`。

---

## 5. 页面与路由规划

### 5.1 路由表（react-router v6）

| 路径 | 页面组件 | 说明 | 主要数据来源 |
| --- | --- | --- | --- |
| `/` | `HomePage` | 首页：Hero + 精选目的地 + 品牌理念 | `GET /api/destinations?featured=true` |
| `/destinations` | `DestinationsPage` | 目的地列表：搜索 + 筛选 + 排序 | `GET /api/destinations` |
| `/destinations/:id` | `DestinationDetail` | 详情：图文 + 留言区 + 预订表单 | `GET /api/destinations/:id` + messages |
| `/about` | `AboutPage` | 关于我们 / 联系方式 | 静态内容 |
| `*` | `NotFoundPage` | 404 | — |

`frontend/src/App.tsx` 结构示意：

```tsx
<Routes>
  <Route element={<Layout />}>
    <Route index element={<HomePage />} />
    <Route path="destinations" element={<DestinationsPage />} />
    <Route path="destinations/:id" element={<DestinationDetail />} />
    <Route path="about" element={<AboutPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route>
</Routes>
```

`Layout` 包含 `<Navbar />`、`<Outlet />`、`<Footer />`。

### 5.2 各页面结构

**首页 HomePage**

1. Hero 区：全幅背景（图片或渐变）+ 主标题「在城市的褶皱里，遇见人文」+ 副文案 + CTA「探索目的地」。
2. 精选目的地网格：取 `featured=true` 的前 3–6 个，复用 `DestinationCard`。
3. 人文理念区：3 栏图文（在地文化 / 深度体验 / 小团出行）。
4. 引导区：指向 `/destinations` 与 `/about`。

**目的地列表 DestinationsPage**

- 顶部 `SearchBar`：按 `q` 关键词搜索（输入防抖 300ms，写进 URL query `?q=`）。
- `TagFilter`：从数据中聚合的标签胶囊，单选/多选（写进 `?tag=`）。
- 区域/国家下拉：`?region=`。排序下拉：`?sort=rating|newest|name`。
- 结果网格：`DestinationCard` 响应式 1/2/3 列。
- 三态：加载中骨架、空结果「换个关键词试试」、错误重试。
- URL 即状态：刷新保持筛选条件（用 `useSearchParams`）。

**目的地详情 DestinationDetail**

1. 面包屑：首页 / 目的地 / {名称}。
2. Hero 大图（`SmartImage`）+ 标题、城市·国家、评分星标、标签。
3. 正文：`description` 分段；`highlights` 列表；`bestSeason` 徽标。
4. 图集 `gallery`（可选）。
5. 留言区：列表 + `MessageForm`（提交后乐观更新或重新拉取）。
6. 预订区：`BookingForm`（出发日期、人数、联系人），成功后就地显示成功提示。

**关于/联系 AboutPage**

- 品牌故事、团队/理念、联系方式（邮箱、社交链接，均用**占位值**，不写真实敏感信息）。
- 可放一个简单联系表单（复用 `MessageForm` 风格，或纯静态展示）。

### 5.3 状态与交互约定

- 数据获取集中在 `hooks/useDestinations.ts`，暴露 `{ data, loading, error, refetch }`。
- 所有列表/详情均需实现 loading / empty / error 三态（`StateView`）。
- 表单提交时按钮进入 disabled + loading，成功后清空并提示，失败展示后端返回的 `error.message`。
- 图片统一走 `SmartImage`，`onError` 时切换到 CSS 渐变占位（见 §6.3、§8）。

---

## 6. 视觉规范（城市人文旅行风）

> 关键词：**暖色调、纸张质感、衬线标题、宽留白、克制装饰**。参考旅行手账 / 人文纪录片海报气质。

### 6.1 配色（设计令牌）

在 `frontend/src/styles/tokens.css` 中用 CSS 变量定义：

```css
:root {
  /* 主色：砖红 */
  --color-brick: #9c3d2e;
  --color-brick-dark: #7a2e22;
  --color-brick-soft: #c96b56;

  /* 辅色：土黄 */
  --color-ochre: #c8963e;
  --color-ochre-soft: #e0b96a;

  /* 强调：深墨绿 */
  --color-forest: #2f4a3c;
  --color-forest-soft: #4a6b57;

  /* 背景与纸感 */
  --color-bg: #f7f1e6;        /* 米白背景 */
  --color-surface: #fffaf1;   /* 卡片面 */
  --color-border: #e4d8c3;    /* 描边 */

  /* 文本 */
  --color-text: #2b2420;      /* 深棕黑正文 */
  --color-text-muted: #6f6157;/* 次要文字 */

  /* 功能色 */
  --color-success: #3f7d58;
  --color-danger: #b3402f;
}
```

用法约定：

- 页面 / 卡片背景用 `--color-bg` / `--color-surface`，正文用 `--color-text`。
- 主按钮 / 关键强调用 `--color-brick`；次要按钮描边用 `--color-forest`。
- 评分星、徽标用 `--color-ochre`。
- 禁止大面积纯黑纯白；保持暖调纸感。

### 6.2 字体

- 标题（Hero、H1–H3、卡片标题）：**衬线字体**
  - 字体栈：`"Noto Serif SC", "Songti SC", Georgia, "Times New Roman", serif`
- 正文 / UI：**无衬线字体**
  - 字体栈：`"Noto Sans SC", "PingFang SC", "Helvetica Neue", Arial, sans-serif`
- 字号阶梯（rem）：`h1 2.5 / h2 2 / h3 1.5 / 正文 1 / 小字 0.875`
- 行高：标题 1.25，正文 1.75（保证中文可读性）。
- 字重：标题 600–700，正文 400，次要文字 400 + `--color-text-muted`。

> 中文字体优先使用系统字体，避免引入大体积 Web Font；如需装饰，仅对拉丁字母标题可选加入 Google Fonts 的 `Playfair Display`（不强制）。

### 6.3 卡片与版式

**DestinationCard**

- 结构：图片（16:10 比例，`object-fit:cover`）→ 内容区内边距 1rem → 标签行 → 标题（衬线）→ 城市·国家 → 评分行。
- 圆角 `--radius: 12px`；描边 `1px solid var(--color-border)`。
- 阴影：默认 `0 2px 10px rgba(43,36,32,.06)`；hover 上浮 `translateY(-4px)` + 阴影加深，过渡 `0.25s ease`。
- hover 时图片轻微放大（`transform: scale(1.04)`，容器 `overflow:hidden`）。
- 图片加载失败 → 显示渐变占位（`linear-gradient(135deg, var(--color-brick-soft), var(--color-ochre))` + 城市名文字）。

**版式**

- 内容最大宽度容器：`max-width: 1120px; margin: 0 auto; padding: 0 1.25rem;`
- 栅格：`display:grid; gap:1.5rem; grid-template-columns: repeat(auto-fill, minmax(280px,1fr));`
- 断点：`≤640px` 单列，`641–1024px` 两列，`>1024px` 三列。
- 区块间距：纵向 `4rem`；标题与内容间距 `1.5rem`。
- 装饰：可用细分隔线、印章式圆形徽标、手写体下标等**少量**点缀，避免花哨。

**Navbar / Footer**

- Navbar：米白半透明底 + 底部分隔线；左 Logo（城市剪影 or 文字标），右导航；移动端折叠为汉堡菜单（可选）。
- Footer：深墨绿底（`--color-forest`）+ 米白文字，含站点简介、导航、联系方式占位、版权。

### 6.4 动效与可访问性

- 仅使用 `transform` / `opacity` 过渡，避免布局抖动。
- 尊重 `prefers-reduced-motion`，用户偏好时关闭动画。
- 交互元素需明显 focus 态（`outline: 2px solid var(--color-ochre)`）。
- 图片 `alt` 使用目的地名称；颜色对比度正文 ≥ 4.5:1。

---

## 7. 初始种子数据

> 文件：`backend/data/seed/destinations.seed.json`（数组，10 条）。字段与 §3.1 完全一致。
> `image` 采用**外部占位服务**：`https://picsum.photos/seed/<slug>/1200/750`（无需 API Key、确定性返回）。详见 §8。
> 首条 `messages.seed.json` 与 `bookings.seed.json` 可为空数组 `[]`，或按下方示例各填 1–2 条。

### 7.1 destinations.seed.json

```json
[
  {
    "id": "seed-kyoto",
    "name": "京都",
    "city": "Kyoto",
    "country": "日本",
    "region": "东亚",
    "tags": ["古寺", "茶道", "和风", "庭园"],
    "summary": "千年古都，寺院与町屋交织的东方美学之城。",
    "description": "京都自平安时代起便是日本的文化心脏。清水寺的悬空舞台、伏见稻荷的千本鸟居、祇园花见小路的木屐声，共同构成一幅缓慢流动的画卷。春樱秋枫之外，深巷中的町家咖啡与前年茶室，让人文旅行者得以在日常里触摸古都的秩序与温度。",
    "image": "https://picsum.photos/seed/kyoto/1200/750",
    "gallery": [],
    "rating": 4.8,
    "reviewCount": 1280,
    "bestSeason": "春 / 秋",
    "highlights": ["清水寺", "伏见稻荷大社", "祇园花见小路", "岚山竹林"],
    "coordinates": { "lat": 35.0116, "lng": 135.7681 },
    "featured": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "seed-paris",
    "name": "巴黎",
    "city": "Paris",
    "country": "法国",
    "region": "西欧",
    "tags": ["艺术", "博物馆", "咖啡馆", "建筑"],
    "summary": "塞纳河畔的艺术之都，博物馆与咖啡馆写满故事。",
    "description": "从卢浮宫到奥赛，从蒙马特高地到左岸咖啡馆，巴黎把几个世纪的美学积淀铺展在街巷之间。清晨的面包香、黄昏的河畔书摊、夜晚亮起灯光的铁塔，让这座城市既是艺术殿堂，也是人文漫步的最佳课堂。",
    "image": "https://picsum.photos/seed/paris/1200/750",
    "gallery": [],
    "rating": 4.7,
    "reviewCount": 2410,
    "bestSeason": "春 / 夏",
    "highlights": ["卢浮宫", "奥赛博物馆", "蒙马特高地", "塞纳河游船"],
    "coordinates": { "lat": 48.8566, "lng": 2.3522 },
    "featured": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "seed-florence",
    "name": "佛罗伦萨",
    "city": "Florence",
    "country": "意大利",
    "region": "南欧",
    "tags": ["文艺复兴", "壁画", "老桥", "手工艺"],
    "summary": "文艺复兴的摇篮，穹顶与壁画下的慢时光。",
    "description": "圣母百花大教堂的穹顶俯瞰着整座红瓦之城。乌菲兹美术馆的珍藏、老桥上的金匠铺、皮具作坊里皮革与针线的气味，让佛罗伦萨成为一部可以步行的文艺复兴史。适合以美术馆与手工艺为线索，安排一场深度人文之旅。",
    "image": "https://picsum.photos/seed/florence/1200/750",
    "gallery": [],
    "rating": 4.8,
    "reviewCount": 1560,
    "bestSeason": "春 / 秋",
    "highlights": ["圣母百花大教堂", "乌菲兹美术馆", "老桥", "米开朗基罗广场"],
    "coordinates": { "lat": 43.7696, "lng": 11.2558 },
    "featured": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "seed-istanbul",
    "name": "伊斯坦布尔",
    "city": "Istanbul",
    "country": "土耳其",
    "region": "西亚",
    "tags": ["清真寺", "市集", "东西交融", "海峡"],
    "summary": "横跨两大洲的十字路口，帝国旧梦与市集烟火。",
    "description": "圣索菲亚与蓝色清真寺隔广场相望，博斯普鲁斯海峡把欧洲与亚洲轻轻分开。大巴扎里香料与地毯的色彩、渡轮上的红茶、黄昏时分宣礼塔的剪影，让伊斯坦布尔成为东西方文明交叠的活体博物馆。",
    "image": "https://picsum.photos/seed/istanbul/1200/750",
    "gallery": [],
    "rating": 4.7,
    "reviewCount": 1890,
    "bestSeason": "春 / 秋",
    "highlights": ["圣索菲亚大教堂", "蓝色清真寺", "大巴扎", "博斯普鲁斯游船"],
    "coordinates": { "lat": 41.0082, "lng": 28.9784 },
    "featured": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "seed-marrakech",
    "name": "马拉喀什",
    "city": "Marrakech",
    "country": "摩洛哥",
    "region": "北非",
    "tags": ["麦地那", "市集", "庭院", "沙漠"],
    "summary": "红土之城的露天市集与隐秘庭院。",
    "description": "德吉玛广场的鼓声与炊烟、麦地那里迷宫般的巷道、里亚德庭院中静谧的水池与瓷砖，构成强烈的感官对照。马拉喀什是通往撒哈拉的门户，也是北非手工与色彩美学的集中表达。",
    "image": "https://picsum.photos/seed/marrakech/1200/750",
    "gallery": [],
    "rating": 4.6,
    "reviewCount": 980,
    "bestSeason": "秋 / 冬",
    "highlights": ["德吉玛广场", "巴西亚宫", "马若雷勒花园", "麦地那老城"],
    "coordinates": { "lat": 31.6295, "lng": -7.9811 },
    "featured": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "seed-varanasi",
    "name": "瓦拉纳西",
    "city": "Varanasi",
    "country": "印度",
    "region": "南亚",
    "tags": ["恒河", "宗教", "古城", "仪式"],
    "summary": "恒河边的圣城，生与死的仪式在此日复一日。",
    "description": "作为世界上最古老的持续居住城市之一，瓦拉纳西的河坛(Ghat)承载着沐浴、祈祷与告别的仪式。清晨的恒河日出、傍晚的阿尔蒂灯火、巷弄深处的寺院钟声，让这里成为理解南亚信仰与日常最直接的现场。",
    "image": "https://picsum.photos/seed/varanasi/1200/750",
    "gallery": [],
    "rating": 4.5,
    "reviewCount": 760,
    "bestSeason": "冬",
    "highlights": ["恒河晨浴", "达萨瓦梅朵河坛", "晚间阿尔蒂", "老城巷弄"],
    "coordinates": { "lat": 25.3176, "lng": 82.9739 },
    "featured": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "seed-lisbon",
    "name": "里斯本",
    "city": "Lisbon",
    "country": "葡萄牙",
    "region": "南欧",
    "tags": ["电车", "瓷砖", "海港", "法多"],
    "summary": "七丘之上的海港之城，电车与法多的乡愁。",
    "description": "黄色电车穿行于阿尔法玛的窄巷，蓝白瓷砖外墙在阳光下闪光。贝伦塔记录大航海时代的荣光，夜晚小酒馆里的法多歌声诉说 saudade 式的怀念。里斯本把海洋记忆与山城生活揉进同一个黄昏。",
    "image": "https://picsum.photos/seed/lisbon/1200/750",
    "gallery": [],
    "rating": 4.7,
    "reviewCount": 1340,
    "bestSeason": "春 / 秋",
    "highlights": ["阿尔法玛老城", "贝伦塔", "28 路电车", "法多酒馆"],
    "coordinates": { "lat": 38.7223, "lng": -9.1393 },
    "featured": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "seed-prague",
    "name": "布拉格",
    "city": "Prague",
    "country": "捷克",
    "region": "中欧",
    "tags": ["哥特建筑", "古堡", "文艺", "桥"],
    "summary": "百塔之城，查理大桥与老城广场的童话氛围。",
    "description": "布拉格城堡俯瞰伏尔塔瓦河，查理大桥上的雕像与街头乐手迎接每一位过客。老城广场的天文钟每到整点报时，窄巷里的木偶店与书吧延续着中欧的文艺传统。适合以建筑与音乐为线索的城市漫步。",
    "image": "https://picsum.photos/seed/prague/1200/750",
    "gallery": [],
    "rating": 4.7,
    "reviewCount": 1120,
    "bestSeason": "春 / 秋",
    "highlights": ["查理大桥", "布拉格城堡", "老城广场天文钟", "伏尔塔瓦河"],
    "coordinates": { "lat": 50.0755, "lng": 14.4378 },
    "featured": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "seed-xian",
    "name": "西安",
    "city": "Xi'an",
    "country": "中国",
    "region": "东亚",
    "tags": ["古都", "城墙", "丝路", "碑刻"],
    "summary": "十三朝古都，城墙与碑林间的丝路起点。",
    "description": "西安曾是丝绸之路的东方起点。完整的明代城墙、兵马俑的沉默军阵、碑林的千年墨迹、回民街的烟火气，让这座城市在厚重的历史与鲜活的日常之间保持张力。可围绕汉唐历史与碑刻书画安排人文线路。",
    "image": "https://picsum.photos/seed/xian/1200/750",
    "gallery": [],
    "rating": 4.8,
    "reviewCount": 2050,
    "bestSeason": "春 / 秋",
    "highlights": ["西安城墙", "秦始皇帝陵博物院", "碑林", "回民街"],
    "coordinates": { "lat": 34.3416, "lng": 108.9398 },
    "featured": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "seed-oaxaca",
    "name": "瓦哈卡",
    "city": "Oaxaca",
    "country": "墨西哥",
    "region": "北美",
    "tags": ["手工艺", "美食", "节庆", "原住民文化"],
    "summary": "墨西哥南部的色彩之城，市集与手工艺的故乡。",
    "description": "瓦哈卡的殖民时期建筑外墙涂满浓烈色彩，市集里摩尔酱、手工织物与陶器琳琅满目。亡灵节期间，万寿菊与剪纸铺满广场与坟园。这里被视为墨西哥原住民文化与美食传统保存最完整的地方之一。",
    "image": "https://picsum.photos/seed/oaxaca/1200/750",
    "gallery": [],
    "rating": 4.6,
    "reviewCount": 640,
    "bestSeason": "秋 / 冬",
    "highlights": ["圣多明各教堂", "贝尼托华雷斯市场", "蒙特阿尔班遗址", "亡灵节"],
    "coordinates": { "lat": 17.0732, "lng": -96.7266 },
    "featured": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "seed-edinburgh",
    "name": "爱丁堡",
    "city": "Edinburgh",
    "country": "英国",
    "region": "西欧",
    "tags": ["古堡", "文学", "石砌老城", "节庆"],
    "summary": "石砌老城与古堡，文学与节庆交织的苏格兰之都。",
    "description": "爱丁堡城堡雄踞火山岩之上，皇家一英里连接城堡与荷里路德宫。老城的石砌巷道、作家博物馆与遍布的书店，让这里自带文学气质。每年八月的艺术节把整座城市变成舞台，是人文旅行者的朝圣地。",
    "image": "https://picsum.photos/seed/edinburgh/1200/750",
    "gallery": [],
    "rating": 4.7,
    "reviewCount": 1010,
    "bestSeason": "夏 / 秋",
    "highlights": ["爱丁堡城堡", "皇家一英里", "亚瑟王座", "八月艺术节"],
    "coordinates": { "lat": 55.9533, "lng": -3.1883 },
    "featured": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 7.2 messages.seed.json（示例）

```json
[
  {
    "id": "seed-msg-1",
    "destinationId": "seed-kyoto",
    "author": "小林",
    "content": "祇园的黄昏太美了，值得再去一次。",
    "rating": 5,
    "createdAt": "2024-02-01T10:00:00.000Z"
  }
]
```

### 7.3 bookings.seed.json

```json
[]
```

> `seed-*` 前缀的固定 id 便于前端演示与测试断言；用户新建的数据使用 UUID，不与种子冲突。

---

## 8. 图片占位方案与环境约定

### 8.1 图片策略（三选一，按优先级）

1. **确定性占位服务（种子默认）**：`https://picsum.photos/seed/<slug>/1200/750`
   - 无需 API Key，同 `seed` 返回固定图片，适合开发与演示。
   - 卡片用小尺寸：`https://picsum.photos/seed/<slug>/600/375`；详情大图用 `1200/750`。
2. **Unsplash 直链（可选替换）**：`https://images.unsplash.com/photo-<PHOTO_ID>?w=1200&q=80&auto=format&fit=crop`
   - 需填入真实的 `PHOTO_ID`；**禁止编造不存在的 id**。
   - 仅用于最终上线时替换，编码阶段不必逐张配置。
3. **纯渐变占位（离线兜底）**：当 `image` 为空串或加载失败时，`SmartImage` 渲染
   `linear-gradient(135deg, var(--color-brick-soft), var(--color-ochre))` + 目的地名称文字。

### 8.2 SmartImage 组件约定

```tsx
// frontend/src/components/SmartImage.tsx
// props: src, alt, ratio(默认 16/10), className
// 逻辑：src 为空或 onError -> 渲染 <div class="img-fallback">，内含渐变背景与 alt 文字
```

统一约束：

- 所有 `<img>` 必须通过 `SmartImage`，保证任意图片失效都不会破版。
- `loading="lazy"`、`decoding="async"`，`alt` 使用目的地名称。
- 详情页 `gallery` 若为空，不渲染图集区块，不报错。

### 8.3 环境变量与安全

- **禁止硬编码任何密钥、Token、真实邮箱、真实电话**。
- 后端 `.env`（本地，不提交）：`PORT=3001`、`CORS_ORIGIN=http://localhost:5173`。
- 前端 `.env`（本地）：`VITE_API_BASE=/api`。
- 提交 `*.env.example` 作为样例，真实 `.env` 加入 `.gitignore`。
- 联系方式、社交链接在页面中使用占位值，如 `hello@example.com`。

---

## 9. 开发与验收清单

### 9.1 实现顺序建议

1. 搭骨架：根 `package.json`（workspaces + concurrently）、`backend`、`frontend` 初始化。
2. 后端：`jsonStore` → `collections` → 路由 → 种子数据 → `GET /api/health` 自测。
3. 前端：设计令牌 → 布局（Navbar/Footer）→ 路由 → `http.ts`/`endpoints.ts` → 卡片与列表 → 详情（留言/预订）→ 首页/关于 → 三态与图片兜底。
4. 联调：Vite proxy、CORS、错误提示。

### 9.2 验收标准

- [ ] `npm install && npm run dev` 可一键启动前后端，无编译错误。
- [ ] 目的地列表返回 ≥ 8 条种子数据；搜索、标签筛选、排序均生效。
- [ ] 目的地详情页展示完整字段 + 留言区 + 预订表单。
- [ ] 提交留言/预订成功后，数据写入对应 JSON 文件；刷新后仍可见（持久化生效）。
- [ ] 提交非法入参返回 400 且前端展示可读错误信息。
- [ ] 所有图片在失效时降级为渐变占位，不出现破图图标。
- [ ] 视觉符合 §6：暖色令牌、衬线标题、米白背景、卡片规范。
- [ ] 移动端（≤640px）单列布局正常。
- [ ] 无任何密钥/敏感信息硬编码。
- [ ] 数据文件原子写入（存在 `.tmp` 中间态后 rename），断电/中断不产生半写文件。

### 9.3 明确不做（Out of Scope）

- 用户注册登录、鉴权系统。
- 在线支付、真实订单/库存。
- 数据库（SQLite/Postgres）与 ORM。
- SSR / SEO 预渲染（如需可后续迁移 Next.js，API 契约不变）。

---

> 文档结束。编码专家实现时若发现契约冲突，以本文档 §3（数据模型）与 §4（API）为准；如需变更，请先更新本文档再改代码。
