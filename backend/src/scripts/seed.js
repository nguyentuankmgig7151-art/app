import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/**
 * 重置运行时数据文件为种子数据。
 * 用法：npm run seed（等价 npm --workspace backend run seed）
 */

const COLLECTIONS = ['destinations', 'messages', 'bookings'];

function readSeed(name) {
  const seedFile = path.join(config.SEED_DIR, `${name}.seed.json`);
  if (!fs.existsSync(seedFile)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

fs.mkdirSync(config.DATA_DIR, { recursive: true });

for (const name of COLLECTIONS) {
  const target = path.join(config.DATA_DIR, `${name}.json`);
  const data = readSeed(name);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, target);
  // eslint-disable-next-line no-console
  console.log(`[seed] ${name}.json 已重置（${data.length} 条）`);
}

// eslint-disable-next-line no-console
console.log('[seed] 完成。');
