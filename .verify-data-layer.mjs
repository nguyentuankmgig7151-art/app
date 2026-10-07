/* 临时验证脚本 —— 验证完成后删除，不属于交付物 */
import assert from 'node:assert/strict';

const B = new URL('./src/', import.meta.url).pathname;

// ---------- 1) 纯 Node（无 window）：内存回退路径 ----------
const fmt = await import(`${B}data/format.js`);
assert.equal(fmt.slugify('Hello World! 你好'), 'hello-world');
assert.equal(fmt.slugify('你好世界'), 'post');
assert.match(fmt.createId('p'), /^p_[a-z0-9]+_[a-z0-9]+$/);
assert.equal(fmt.formatDate('2025-07-18'), '2025 年 7 月 18 日');
assert.equal(fmt.formatDate('bad-input'), 'bad-input');
assert.equal(fmt.formatDate(''), '');
assert.ok(fmt.estimateReadingTime('一段中文内容'.repeat(400)) >= 2);
assert.equal(fmt.estimateReadingTime(''), 1);
assert.equal(fmt.truncate('abcdefghij', 5), 'abcde…');
assert.equal(fmt.truncate('abc', 5), 'abc');
assert.equal(fmt.isExternalUrl('https://example.com'), true);
assert.equal(fmt.isExternalUrl('mailto:a@b.c'), false);
console.log('format.js: 全部断言通过');

const s = await import(`${B}data/storage.js`);
assert.equal(s.STORAGE_KEYS.posts, 'nb:posts');
assert.equal(s.STORAGE_KEYS.schemaVersion, 'nb:schema-version');
assert.equal(s.SCHEMA_VERSION, 1);
assert.equal(s.isStorageAvailable(), false, 'Node 环境应判定 storage 不可用');
assert.equal(s.readRaw('nb:posts'), null);
assert.equal(s.readJSON('nb:posts', []).length, 0);
assert.equal(s.writeJSON('nb:x', { a: 1 }), true, '内存回退写入应成功');
assert.deepEqual(s.readJSON('nb:x', null), { a: 1 });

const seeded = s.ensureSeeded();
assert.equal(seeded.seeded, true);
assert.equal(seeded.posts, 6);
assert.equal(seeded.works, 6);
const again = s.ensureSeeded();
assert.equal(again.seeded, false, 'ensureSeeded 必须幂等');
assert.equal(s.getPosts().length, 6);
assert.equal(s.getWorks().length, 6);

const post = s.getPostBySlug('react-render-performance-checklist');
assert.ok(post && post.title.includes('React'));
const all = s.getPosts();
assert.equal(new Set(all.map((p) => p.slug)).size, 6, 'slug 全局唯一');
all.forEach((p) => {
  for (const f of ['id', 'title', 'slug', 'summary', 'content', 'createdAt']) assert.ok(p[f], `${p.slug} 缺 ${f}`);
  assert.ok(Array.isArray(p.tags) && p.tags.length >= 1 && p.tags.length <= 5);
  assert.ok(new Date(p.createdAt).getTime() > 0);
});
const tagSet = new Set(all.flatMap((p) => p.tags));
assert.ok(tagSet.size >= 6, `标签覆盖不足: ${[...tagSet]}`);
assert.ok(all.every((p) => p.content.includes('## ') && p.content.includes('- ') && p.content.includes('> ') && p.content.includes('```') && p.content.includes('**')));

const works = s.getWorks();
assert.equal(works.length, 6);
works.forEach((w) => {
  for (const f of ['id', 'title', 'desc', 'tech']) assert.ok(w[f], `${w.id} 缺 ${f}`);
  assert.ok(Array.isArray(w.tech) && w.tech.length >= 1 && w.tech.length <= 8);
  assert.equal(typeof w.links, 'object');
  assert.ok(w.links.demo || w.links.repo, `${w.id} 缺少 demo/repo`);
});
assert.equal(new Set(works.map((w) => w.id)).size, 6);

// upsert / delete
const created = s.upsertPost({ title: '临时测试文章', summary: '摘要', tags: ['测试', '测试', ' '], content: '正文' });
assert.ok(created.id.startsWith('p_'));
assert.deepEqual(created.tags, ['测试'], '去重');
assert.equal(s.getPosts().length, 7);
const created2 = s.upsertPost({ id: created.id, title: '临时测试文章 v2' });
assert.equal(created2.id, created.id);
assert.equal(created2.title, '临时测试文章 v2');
assert.ok(created2.updatedAt, '更新时应写入 updatedAt');
assert.equal(s.getPosts().length, 7, '更新不应新增');
assert.equal(s.deletePost(created.id), true);
assert.equal(s.deletePost(created.id), false, '重复删除应返回 false');
assert.equal(s.getPosts().length, 6);

// 同标题 slug 冲突
const a = s.upsertPost({ title: 'Duplicate Slug' });
const b = s.upsertPost({ title: 'Duplicate Slug' });
assert.notEqual(a.slug, b.slug, 'slug 冲突应自动加后缀');
assert.equal(s.deletePost(a.id) && s.deletePost(b.id), true);

// works upsert/delete
const w = s.upsertWork({ title: '临时作品', desc: '描述', tech: ['A'], links: { demo: 'https://example.com/x', evil: 'x' } });
assert.deepEqual(w.links, { demo: 'https://example.com/x' }, 'links 仅保留白名单字段');
assert.equal(s.getWorks().length, 7);
assert.equal(s.deleteWork(w.id), true);
assert.equal(s.getWorks().length, 6);

// theme
assert.equal(s.getTheme(), 'dark', '默认 dark');
assert.equal(s.setTheme('light'), 'light');
assert.equal(s.getTheme(), 'light');
assert.equal(s.setTheme('nonsense'), 'dark', '非法值回退 dark');
assert.equal(s.getTheme(), 'dark');

// profile
assert.equal(s.getProfile().name, '沈知远');
const p2 = s.saveProfile({ role: '前端工程师（临时）' });
assert.equal(p2.role, '前端工程师（临时）');
assert.equal(s.getProfile().role, '前端工程师（临时）');
assert.equal(s.getProfile().brand, '夜航手记', '浅合并保留静态字段');

// 脏数据容错
s.writeJSON(s.STORAGE_KEYS.posts, 'not-an-array');
assert.deepEqual(s.getPosts(), [], '非数组脏数据 → []');
assert.equal(s.ensureSeeded().seeded, true, '脏数据应重新注入种子');
assert.equal(s.resetToSeed().posts, true);

// replacePosts
assert.equal(s.replacePosts([{ title: 'Only One', tags: ['x'], content: 'c' }]), true);
assert.equal(s.getPosts().length, 1);
assert.equal(s.resetToSeed().posts, true);

// clearNamespace 只清 nb:
s.writeJSON('other:key', { keep: true });
s.clearNamespace();
assert.equal(s.readRaw('other:key') !== null, true, '非 nb: 前缀不应被清理');
console.log('storage.js（无 window / 内存回退）: 全部断言通过');

// ---------- 2) 模拟浏览器：真实 localStorage 路径 + 事件广播 ----------
class FakeStorage {
  #map = new Map();
  get length() { return this.#map.size; }
  key(i) { return [...this.#map.keys()][i] ?? null; }
  getItem(k) { return this.#map.has(k) ? this.#map.get(k) : null; }
  setItem(k, v) { this.#map.set(k, String(v)); }
  removeItem(k) { this.#map.delete(k); }
}
const listeners = new Map();
globalThis.window = {
  localStorage: new FakeStorage(),
  dispatchEvent(event) { (listeners.get(event.type) || []).forEach((fn) => fn(event)); return true; },
  addEventListener(type, fn) { listeners.set(type, [...(listeners.get(type) || []), fn]); },
  removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) || []).filter((f) => f !== fn)); },
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};

const s2 = await import(`${B}data/storage.js`);
assert.equal(s2.isStorageAvailable(), true);

const seenKeys = [];
const unsubscribe = s2.subscribeStorage(({ key, source }) => seenKeys.push(`${source}:${key}`));
assert.equal(s2.ensureSeeded().seeded, true);
assert.ok(seenKeys.includes('local:nb:posts'));
assert.ok(seenKeys.includes('local:nb:works'));
assert.ok(seenKeys.includes('local:nb:schema-version'));
assert.equal(s2.ensureSeeded().seeded, false);
assert.equal(window.localStorage.getItem('nb:posts').startsWith('['), true, '真实写入 localStorage');
assert.equal(window.localStorage.getItem('nb:works').startsWith('['), true);
assert.equal(window.localStorage.getItem('nb:posts').includes('react-render-performance-checklist'), true);
assert.equal(window.localStorage.getItem('nb:works').includes('night-log'), true);
assert.equal(window.localStorage.getItem('nb:schema-version'), '1');

// 主题以「纯字符串」落库，保证 index.html 首屏脚本可读
s2.setTheme('light');
assert.equal(window.localStorage.getItem('nb:theme'), 'light');
assert.equal(s2.getTheme(), 'light');
// 兼容 JSON 引号写法
window.localStorage.setItem('nb:theme', '"dark"');
assert.equal(s2.getTheme(), 'dark');

// 跨标签页原生 storage 事件
s2.setTheme('light');
const before = seenKeys.length;
const nativeFn = (listeners.get('storage') || [])[0];
nativeFn({ key: 'nb:theme' });
assert.equal(seenKeys.length, before + 1);
assert.equal(seenKeys.at(-1), 'storage:nb:theme');
// 其它命名空间的 key 不应触发
nativeFn({ key: 'other:key' });
assert.equal(seenKeys.length, before + 1, '非 nb: 前缀的 storage 事件应被忽略');

unsubscribe();
const afterUnsub = seenKeys.length;
s2.setTheme('dark');
assert.equal(seenKeys.length, afterUnsub, '取消订阅后不应再收到事件');

// 配额溢出
window.localStorage.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
assert.equal(s2.writeJSON('nb:big', { a: 1 }), false, '配额溢出应返回 false 且不抛错');
console.log('storage.js（模拟浏览器 / 原生 localStorage）: 全部断言通过');

// ---------- 3) utils 兼容入口 ----------
const u = await import(`${B}utils/storage.js`);
assert.equal(u.STORAGE_KEYS.theme, 'nb:theme');
assert.equal(typeof u.upsertPost, 'function');
assert.equal(typeof u.ensureSeeded, 'function');
console.log('utils/storage.js 兼容入口: 通过');

console.log('\n✅ 数据层全部验证通过');
