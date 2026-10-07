import { getCollection, saveCollection } from './jsonStore.js';
import { newId, nowIso } from '../utils/id.js';

/**
 * 业务级集合封装：destinations / messages / bookings。
 * 读操作走内存；写操作更新内存后调用 saveCollection 原子落盘。
 */

export const COLLECTIONS = ['destinations', 'messages', 'bookings'];

export const BOOKING_STATUS = ['pending', 'confirmed', 'cancelled'];

/* ------------------------------------------------------------------ */
/* Destinations                                                        */
/* ------------------------------------------------------------------ */

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * 列表查询：关键词 / 标签 / 大区 / 国家 / 精选 / 排序 / 分页。
 * @param {{ q?: string, tag?: string, region?: string, country?: string,
 *           featured?: boolean, sort?: string, limit?: number, offset?: number }} params
 */
export function listDestinations(params = {}) {
  const {
    q,
    tag,
    region,
    country,
    featured,
    sort = 'rating',
    limit = 50,
    offset = 0,
  } = params;

  let items = getCollection('destinations').slice();

  if (q) {
    const needle = normalizeText(q);
    items = items.filter((d) => {
      const haystack = [d.name, d.city, d.country, d.summary, ...(d.tags || [])]
        .map(normalizeText)
        .join(' ');
      return haystack.includes(needle);
    });
  }

  if (tag) {
    const needle = normalizeText(tag);
    items = items.filter((d) =>
      (d.tags || []).some((t) => normalizeText(t) === needle)
    );
  }

  if (region) {
    const needle = normalizeText(region);
    items = items.filter((d) => normalizeText(d.region) === needle);
  }

  if (country) {
    const needle = normalizeText(country);
    items = items.filter((d) => normalizeText(d.country) === needle);
  }

  if (featured === true) {
    items = items.filter((d) => d.featured === true);
  }

  if (sort === 'newest') {
    items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  } else if (sort === 'name') {
    items.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'));
  } else {
    // 默认：评分降序
    items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  const total = items.length;
  const start = Math.max(0, offset);
  const end = start + Math.max(0, limit);
  return { total, items: items.slice(start, end) };
}

/**
 * 按 id 取单个目的地。
 * @param {string} id
 */
export function getDestination(id) {
  return getCollection('destinations').find((d) => d.id === id) ?? null;
}

/**
 * 目的地是否存在。
 * @param {string} id
 */
export function destinationExists(id) {
  return getDestination(id) !== null;
}

/**
 * 新增目的地（服务端补全 id / createdAt / 默认值）。
 * @param {object} payload 已通过校验的字段
 */
export function createDestination(payload) {
  const record = {
    id: newId(),
    name: payload.name,
    city: payload.city,
    country: payload.country,
    region: payload.region ?? '',
    tags: payload.tags ?? [],
    summary: payload.summary,
    description: payload.description ?? '',
    image: payload.image ?? '',
    gallery: payload.gallery ?? [],
    rating: payload.rating ?? 0,
    reviewCount: payload.reviewCount ?? 0,
    bestSeason: payload.bestSeason ?? '',
    highlights: payload.highlights ?? [],
    coordinates: payload.coordinates ?? null,
    featured: payload.featured ?? false,
    createdAt: nowIso(),
  };
  const collection = getCollection('destinations');
  collection.push(record);
  saveCollection('destinations', collection);
  return record;
}

/**
 * 删除目的地，并级联删除其留言。
 * @param {string} id
 * @returns {boolean} 是否删除成功（false = 不存在）
 */
export function deleteDestination(id) {
  const collection = getCollection('destinations');
  const index = collection.findIndex((d) => d.id === id);
  if (index === -1) return false;
  collection.splice(index, 1);
  saveCollection('destinations', collection);

  const messages = getCollection('messages');
  const remaining = messages.filter((m) => m.destinationId !== id);
  if (remaining.length !== messages.length) {
    saveCollection('messages', remaining);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

/**
 * 某目的地的留言列表。
 * @param {string} destinationId
 * @param {{ limit?: number, offset?: number }} options
 */
export function listMessages(destinationId, options = {}) {
  const { limit = 50, offset = 0 } = options;
  let items = getCollection('messages').filter(
    (m) => m.destinationId === destinationId
  );
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const total = items.length;
  const start = Math.max(0, offset);
  const end = start + Math.max(0, limit);
  return { total, items: items.slice(start, end) };
}

/**
 * 新增留言。
 * @param {object} payload
 */
export function createMessage(payload) {
  const record = {
    id: newId(),
    destinationId: payload.destinationId,
    author: payload.author,
    content: payload.content,
    createdAt: nowIso(),
  };
  if (payload.email) record.email = payload.email;
  if (payload.rating !== undefined && payload.rating !== null) {
    record.rating = payload.rating;
  }
  const collection = getCollection('messages');
  collection.push(record);
  saveCollection('messages', collection);
  return record;
}

/**
 * 删除留言。
 * @param {string} id
 */
export function deleteMessage(id) {
  const collection = getCollection('messages');
  const index = collection.findIndex((m) => m.id === id);
  if (index === -1) return false;
  collection.splice(index, 1);
  saveCollection('messages', collection);
  return true;
}

/**
 * 移除邮箱字段（隐私：响应不回显 email）。
 * @param {object} message
 */
export function toPublicMessage(message) {
  if (!message) return message;
  const { email, ...rest } = message;
  return rest;
}

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */

/**
 * 预订列表（管理用途）。
 * @param {{ limit?: number, offset?: number }} options
 */
export function listBookings(options = {}) {
  const { limit = 50, offset = 0 } = options;
  const items = getCollection('bookings').slice();
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const total = items.length;
  const start = Math.max(0, offset);
  const end = start + Math.max(0, limit);
  return { total, items: items.slice(start, end) };
}

/**
 * 新增预订意向（status 默认 pending）。
 * @param {object} payload
 */
export function createBooking(payload) {
  const record = {
    id: newId(),
    destinationId: payload.destinationId,
    name: payload.name,
    email: payload.email,
    travelDate: payload.travelDate,
    guests: payload.guests,
    status: 'pending',
    createdAt: nowIso(),
  };
  if (payload.phone) record.phone = payload.phone;
  if (payload.notes) record.notes = payload.notes;
  const collection = getCollection('bookings');
  collection.push(record);
  saveCollection('bookings', collection);
  return record;
}

export default {
  COLLECTIONS,
  BOOKING_STATUS,
  listDestinations,
  getDestination,
  destinationExists,
  createDestination,
  deleteDestination,
  listMessages,
  createMessage,
  deleteMessage,
  toPublicMessage,
  listBookings,
  createBooking,
};
