// 各接口调用函数，字段/路径严格对齐 docs/architecture.md §6
import { http } from './http.js';

// §6.1 Auth
export const authApi = {
  register: (body) => http.post('/api/auth/register', body),
  login: (body) => http.post('/api/auth/login', body),
  me: () => http.get('/api/auth/me'),
};

// §6.2 Users
export const usersApi = {
  get: (id) => http.get(`/api/users/${id}`),
  posts: (id, params) => http.get(`/api/users/${id}/posts`, params),
  followers: (id, params) => http.get(`/api/users/${id}/followers`, params),
  following: (id, params) => http.get(`/api/users/${id}/following`, params),
  updateMe: (body) => http.put('/api/users/me', body),
  follow: (id) => http.post(`/api/users/${id}/follow`),
  unfollow: (id) => http.del(`/api/users/${id}/follow`),
};

// §6.3 Posts
export const postsApi = {
  list: (params) => http.get('/api/posts', params),
  create: (body) => http.post('/api/posts', body),
  get: (id) => http.get(`/api/posts/${id}`),
  update: (id, body) => http.put(`/api/posts/${id}`, body),
  remove: (id) => http.del(`/api/posts/${id}`),
};

// §6.4 Comments
export const commentsApi = {
  list: (postId, params) => http.get(`/api/posts/${postId}/comments`, params),
  create: (postId, body) => http.post(`/api/posts/${postId}/comments`, body),
  remove: (id) => http.del(`/api/comments/${id}`),
};

// §6.5 Likes
export const likesApi = {
  like: (postId) => http.post(`/api/posts/${postId}/like`),
  unlike: (postId) => http.del(`/api/posts/${postId}/like`),
};

// §6.6 Tags
export const tagsApi = {
  list: (params) => http.get('/api/tags', params),
  posts: (name, params) =>
    http.get(`/api/tags/${encodeURIComponent(name)}/posts`, params),
};

// §6.7 Search
export const searchApi = {
  search: (params) => http.get('/api/search', params),
};
