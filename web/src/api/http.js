// 统一 fetch 封装（docs/architecture.md §5、§7）
// - API base 走 VITE_API_BASE，默认 ''（开发环境由 Vite dev proxy 转发 /api -> localhost:3001）
// - 自动注入 Authorization: Bearer <token>
// - 按统一响应体 { code, message, data } 解包；非 0 code 抛 ApiError
// - code 2001/2002 时清除本地 token 并触发登出事件

export const API_BASE = import.meta.env.VITE_API_BASE ?? '';
const TOKEN_KEY = 'token';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message || '请求失败');
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function buildQuery(params) {
  if (!params) return '';
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.append(k, v);
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

/**
 * 发起 API 请求。
 * @param {string} method HTTP 方法
 * @param {string} path 以 /api 开头的路径
 * @param {object} [opts] { body, params }
 * @returns {Promise<any>} 统一响应中的 data 字段
 */
export async function request(method, path, opts = {}) {
  const { body, params } = opts;
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}${buildQuery(params)}`, {
      method,
      headers,
      body: payload,
    });
  } catch (e) {
    throw new ApiError(-1, '网络请求失败，请确认后端服务已启动', 0);
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // 非 JSON 响应
  }

  // 鉴权失效：清除 token 并广播登出
  if (json && (json.code === 2001 || json.code === 2002)) {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new ApiError(json.code, json.message, res.status);
  }

  if (!res.ok || !json || json.code !== 0) {
    const code = json ? json.code : res.status;
    const message = json && json.message ? json.message : `请求失败（HTTP ${res.status}）`;
    throw new ApiError(code, message, res.status);
  }

  return json.data;
}

export const http = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  del: (path) => request('DELETE', path),
};
