'use strict';

/**
 * better-sqlite3 连接（单例）。
 * 首次启动：自动创建数据目录 → 建表（schema.sql）→ 载入演示数据（seed）。
 * 为什么用单例：better-sqlite3 是同步 API，连接轻量，全应用共享一个连接即可。
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { config } = require('../config');

const dataDir = path.dirname(config.dbPath);
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(config.dbPath);

// 强制外键约束（SQLite 默认关闭），并启用 WAL 提升并发读性能。
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// 执行建表 SQL（幂等：全部 CREATE ... IF NOT EXISTS）。
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// 空库时自动载入演示数据，保证「修完即跑」。
const { seedIfEmpty } = require('./seed');
seedIfEmpty(db);

module.exports = db;
