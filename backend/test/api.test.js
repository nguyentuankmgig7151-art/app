import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');
const TEST_DATA_DIR = path.join(BACKEND_DIR, 'data-test');
const SEED_SRC = path.join(BACKEND_DIR, 'data', 'seed');

// 使用独立测试数据目录，避免污染运行时 data/
fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
fs.cpSync(SEED_SRC, path.join(TEST_DATA_DIR, 'seed'), { recursive: true });

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = TEST_DATA_DIR;

const { createApp } = await import('../src/app.js');
const { flush } = await import('../src/store/jsonStore.js');
const { COLLECTIONS } = await import('../src/store/collections.js');

const app = createApp();
const server = app.listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

after(async () => {
  await Promise.all(COLLECTIONS.map((name) => flush(name)));
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test('GET /api/health 返回 ok', async () => {
  const res = await fetch(`${base}/api/health`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'ok');
});

test('GET /api/destinations 返回种子列表（11 条）', async () => {
  const res = await fetch(`${base}/api/destinations`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.total, 11);
});

test('GET /api/destinations?q= 搜索生效', async () => {
  const res = await fetch(`${base}/api/destinations?q=${encodeURIComponent('京都')}`);
  const body = await res.json();
  assert.equal(body.data.total, 1);
  assert.equal(body.data.items[0].name, '京都');
});

test('GET /api/destinations/:id 不存在返回 404 NOT_FOUND', async () => {
  const res = await fetch(`${base}/api/destinations/does-not-exist`);
  const body = await res.json();
  assert.equal(res.status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('POST /api/messages 缺少 author 返回 400 VALIDATION_ERROR', async () => {
  const res = await fetch(`${base}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destinationId: 'seed-kyoto', content: 'hi' }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('POST /api/messages 成功且响应不含 email', async () => {
  const res = await fetch(`${base}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationId: 'seed-kyoto',
      author: '测试者',
      email: 't@example.com',
      content: '很好',
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.email, undefined);
});

test('未知路由返回 404 ROUTE_NOT_FOUND', async () => {
  const res = await fetch(`${base}/api/unknown`);
  const body = await res.json();
  assert.equal(res.status, 404);
  assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
});
