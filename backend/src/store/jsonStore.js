import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/**
 * JSON 文件存储层。
 *
 * 设计要点（见 docs/SPEC.md §1.3）：
 * - 启动时把 JSON 读入内存（Map），读操作走内存；
 * - 写操作先更新内存，再原子落盘（tmp + rename）；
 * - 同一文件的并发写通过 Promise 队列串行化；
 * - 首次启动若数据文件不存在，自动从 seed 复制生成。
 */

/** @type {Map<string, any[]>} 集合名 -> 内存数据 */
const cache = new Map();

/** @type {Map<string, Promise<void>>} 集合名 -> 写队列尾部 Promise */
const writeQueues = new Map();

/**
 * 运行时数据文件路径。
 * @param {string} name
 */
function dataFile(name) {
  return path.join(config.DATA_DIR, `${name}.json`);
}

/**
 * 种子文件路径。
 * @param {string} name
 */
function seedFile(name) {
  return path.join(config.SEED_DIR, `${name}.seed.json`);
}

/**
 * 读取并解析 JSON 文件；失败返回 null。
 * @param {string} file
 */
function readJsonSafe(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
}

/**
 * 确保数据文件存在：不存在时用 seed 初始化，seed 也没有则空数组。
 * @param {string} name
 */
function ensureDataFile(name) {
  const target = dataFile(name);
  if (fs.existsSync(target)) return;
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  const seeded = readJsonSafe(seedFile(name));
  const initial = seeded ?? [];
  fs.writeFileSync(target, JSON.stringify(initial, null, 2) + '\n', 'utf8');
}

/**
 * 初始化存储：确保目录与文件、载入内存。
 * @param {string[]} names 集合名列表
 */
export function initStore(names) {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  for (const name of names) {
    ensureDataFile(name);
    const data = readJsonSafe(dataFile(name));
    cache.set(name, data ?? []);
  }
}

/**
 * 从内存读取集合（返回内存数组引用；修改后需调用 saveCollection 落盘）。
 * @param {string} name
 * @returns {any[]}
 */
export function getCollection(name) {
  if (!cache.has(name)) {
    throw new Error(`集合未初始化: ${name}`);
  }
  return cache.get(name);
}

/**
 * 更新内存并原子落盘（写队列串行化）。
 * @param {string} name
 * @param {any[]} data
 * @returns {Promise<void>}
 */
export function saveCollection(name, data) {
  cache.set(name, data);
  const prev = writeQueues.get(name) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => atomicWrite(dataFile(name), data));
  writeQueues.set(name, next);
  return next;
}

/**
 * 原子写：先写 .tmp，再 rename 覆盖目标，避免半写损坏。
 * @param {string} file
 * @param {any} data
 */
async function atomicWrite(file, data) {
  const tmp = `${file}.tmp`;
  const payload = JSON.stringify(data, null, 2) + '\n';
  await fsp.writeFile(tmp, payload, 'utf8');
  await fsp.rename(tmp, file);
}

/**
 * 等待某集合写队列排空（测试/关停时使用）。
 * @param {string} name
 */
export async function flush(name) {
  const q = writeQueues.get(name);
  if (q) await q.catch(() => {});
}

/**
 * 从种子重置某集合（数据文件不存在或损坏时兜底）。
 * @param {string} name
 */
export function resetFromSeed(name) {
  const seeded = readJsonSafe(seedFile(name)) ?? [];
  cache.set(name, seeded);
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  fs.writeFileSync(dataFile(name), JSON.stringify(seeded, null, 2) + '\n', 'utf8');
}

export default {
  initStore,
  getCollection,
  saveCollection,
  flush,
  resetFromSeed,
};
