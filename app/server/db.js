/**
 * 数据库初始化：使用 Node 内置 node:sqlite，无需任何第三方依赖。
 * 职责：打开数据库连接、建表、写入初始分类标签与示例凭证。
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(currentDir, '..', 'data');
export const databasePath = join(dataDir, 'voucher.db');

mkdirSync(dataDir, { recursive: true });

export const database = new DatabaseSync(databasePath);

// 外键约束默认关闭，必须显式开启，否则分录不会随凭证级联删除
database.exec('PRAGMA foreign_keys = ON');
// WAL 模式提升读写并发安全性
database.exec('PRAGMA journal_mode = WAL');

database.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    color       TEXT    NOT NULL DEFAULT '#4f7cff',
    created_at  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_word     TEXT    NOT NULL DEFAULT '记',
    voucher_number   INTEGER NOT NULL,
    voucher_date     TEXT    NOT NULL,
    summary          TEXT    NOT NULL DEFAULT '',
    category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    attachment_count INTEGER NOT NULL DEFAULT 0,
    prepared_by      TEXT    NOT NULL DEFAULT '',
    reviewed_by      TEXT    NOT NULL DEFAULT '',
    created_at       TEXT    NOT NULL,
    updated_at       TEXT    NOT NULL,
    UNIQUE (voucher_word, voucher_number, voucher_date)
  );

  CREATE TABLE IF NOT EXISTS voucher_entries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id   INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    line_number  INTEGER NOT NULL,
    summary      TEXT    NOT NULL DEFAULT '',
    account_code TEXT    NOT NULL DEFAULT '',
    account_name TEXT    NOT NULL DEFAULT '',
    debit        REAL    NOT NULL DEFAULT 0,
    credit       REAL    NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_entries_voucher ON voucher_entries(voucher_id);
  CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(voucher_date);
`);

const existingCategoryCount = database.prepare('SELECT COUNT(*) AS total FROM categories').get().total;
if (existingCategoryCount === 0) {
  seedInitialData();
}

/** 首次启动写入默认分类标签与两张示例凭证，方便直接查看界面效果 */
function seedInitialData() {
  const now = new Date().toISOString();
  const insertCategory = database.prepare(
    'INSERT INTO categories (name, color, created_at) VALUES (?, ?, ?)'
  );
  const categorySeeds = [
    ['主营业务收入', '#2f9e6e'],
    ['管理费用', '#e0823d'],
    ['银行结算', '#4f7cff'],
  ];
  const categoryIds = categorySeeds.map(
    ([name, color]) => insertCategory.run(name, color, now).lastInsertRowid
  );

  const insertVoucher = database.prepare(`
    INSERT INTO vouchers
      (voucher_word, voucher_number, voucher_date, summary, category_id,
       attachment_count, prepared_by, reviewed_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEntry = database.prepare(`
    INSERT INTO voucher_entries
      (voucher_id, line_number, summary, account_code, account_name, debit, credit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const voucherSeeds = [
    {
      word: '记',
      number: 1,
      date: '2024-06-05',
      summary: '销售商品收到货款',
      categoryId: categoryIds[0],
      attachmentCount: 2,
      preparedBy: '张会计',
      reviewedBy: '李主管',
      entries: [
        ['销售商品收到货款', '1002', '银行存款', 50000, 0],
        ['销售商品收到货款', '6001', '主营业务收入', 0, 50000],
      ],
    },
    {
      word: '记',
      number: 2,
      date: '2024-06-08',
      summary: '支付办公室水电费',
      categoryId: categoryIds[1],
      attachmentCount: 1,
      preparedBy: '张会计',
      reviewedBy: '李主管',
      entries: [
        ['支付办公室水电费', '6602', '管理费用—水电费', 1860.5, 0],
        ['支付办公室水电费', '1002', '银行存款', 0, 1860.5],
      ],
    },
  ];

  for (const voucher of voucherSeeds) {
    const voucherId = insertVoucher.run(
      voucher.word,
      voucher.number,
      voucher.date,
      voucher.summary,
      voucher.categoryId,
      voucher.attachmentCount,
      voucher.preparedBy,
      voucher.reviewedBy,
      now,
      now
    ).lastInsertRowid;

    voucher.entries.forEach((entry, index) => {
      insertEntry.run(voucherId, index + 1, entry[0], entry[1], entry[2], entry[3], entry[4]);
    });
  }
}
