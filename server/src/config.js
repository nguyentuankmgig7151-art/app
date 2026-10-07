'use strict';

/**
 * 集中式配置：先在启动最早阶段加载 .env，再读取 process.env。
 * 为什么这样做：密钥等敏感信息必须来自环境变量（见 architecture.md §8.4），
 * 代码里绝不硬编码；同时保证 Node 18+ 都能读取 .env（不引入 dotenv 依赖）。
 */
const fs = require('fs');
const path = require('path');

const serverRoot = path.resolve(__dirname, '..'); // 指向 server/
const envPath = path.join(serverRoot, '.env');

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  // Node 20.12+ 内置 loadEnvFile；旧版本用极简解析兜底。
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(file);
    return;
  }
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// 模块加载即读取 .env（若存在），使后续所有 require 都能用到环境变量。
loadDotEnv(envPath);

const config = {
  serverRoot,
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // DB_PATH 允许相对路径，相对于 server/ 目录解析
  dbPath: path.resolve(serverRoot, process.env.DB_PATH || 'data/community.db'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

/**
 * 校验必填配置；缺失时直接抛错终止启动（architecture.md §8.4：JWT_SECRET 缺失时启动报错）。
 */
function assertConfig() {
  if (!config.jwtSecret) {
    throw new Error(
      '缺少环境变量 JWT_SECRET。请复制 server/.env.example 为 server/.env 并设置密钥。'
    );
  }
  if (config.jwtSecret.length < 8) {
    throw new Error('JWT_SECRET 太短（至少 8 个字符），请使用足够长的随机串。');
  }
}

module.exports = { config, assertConfig };
