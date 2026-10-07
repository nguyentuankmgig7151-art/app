import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// backend/ 根目录（src/ 的上一级）
export const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * 极简 .env 加载器（零额外依赖）。
 * 仅解析 KEY=VALUE 行，已存在的 process.env 值优先，不覆盖。
 * @param {string} file
 */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(ROOT_DIR, '.env'));

const dataDirSetting = process.env.DATA_DIR;
const dataDir = dataDirSetting
  ? path.resolve(ROOT_DIR, dataDirSetting)
  : path.join(ROOT_DIR, 'data');

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number.parseInt(process.env.PORT || '3001', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  DATA_DIR: dataDir,
  SEED_DIR: path.join(dataDir, 'seed'),
};

export default config;
