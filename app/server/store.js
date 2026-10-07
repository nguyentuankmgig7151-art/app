/**
 * 数据访问层：封装分类标签、凭证、分录的全部读写与业务校验。
 * 所有金额在比较时统一转成「分」的整数，避免浮点误差导致借贷不平。
 */
import { database } from './db.js';

/** 业务校验失败异常，API 层据此返回 400 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const centsFromAmount = (amount) => Math.round(Number(amount) * 100);
const amountFromCents = (cents) => Number((cents / 100).toFixed(2));
const nowIso = () => new Date().toISOString();

/* ---------------------------------- 分类标签 ---------------------------------- */

export function listCategories() {
  return database
    .prepare(
      `SELECT c.id, c.name, c.color, c.created_at AS createdAt,
              (SELECT COUNT(*) FROM vouchers v WHERE v.category_id = c.id) AS voucherCount
         FROM categories c
        ORDER BY c.id ASC`
    )
    .all();
}

export function createCategory({ name, color }) {
  const trimmedName = String(name ?? '').trim();
  if (!trimmedName) {
    throw new ValidationError('分类名称不能为空');
  }
  if (trimmedName.length > 30) {
    throw new ValidationError('分类名称不能超过 30 个字符');
  }
  const exists = database.prepare('SELECT id FROM categories WHERE name = ?').get(trimmedName);
  if (exists) {
    throw new ValidationError(`分类「${trimmedName}」已存在`);
  }
  const result = database
    .prepare('INSERT INTO categories (name, color, created_at) VALUES (?, ?, ?)')
    .run(trimmedName, normalizeColor(color), nowIso());
  return database
    .prepare('SELECT id, name, color, created_at AS createdAt FROM categories WHERE id = ?')
    .get(result.lastInsertRowid);
}

export function updateCategory(id, { name, color }) {
  const categoryId = Number(id);
  const current = database.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  if (!current) {
    throw new ValidationError('分类不存在');
  }
  const trimmedName = String(name ?? current.name).trim();
  if (!trimmedName) {
    throw new ValidationError('分类名称不能为空');
  }
  const duplicated = database
    .prepare('SELECT id FROM categories WHERE name = ? AND id <> ?')
    .get(trimmedName, categoryId);
  if (duplicated) {
    throw new ValidationError(`分类「${trimmedName}」已存在`);
  }
  database
    .prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?')
    .run(trimmedName, normalizeColor(color ?? current.color), categoryId);
  return database
    .prepare('SELECT id, name, color, created_at AS createdAt FROM categories WHERE id = ?')
    .get(categoryId);
}

export function deleteCategory(id) {
  const categoryId = Number(id);
  const current = database.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
  if (!current) {
    throw new ValidationError('分类不存在');
  }
  // 分类被删除后，相关凭证的 category_id 由外键规则置为 NULL，凭证本身保留
  database.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
  return { id: categoryId };
}

function normalizeColor(color) {
  const value = String(color ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#4f7cff';
}

/* ----------------------------------- 凭证 ----------------------------------- */

export function listVouchers({ keyword = '', categoryId = '', startDate = '', endDate = '', page = 1, pageSize = 10 } = {}) {
  const conditions = [];
  const params = [];

  if (keyword.trim()) {
    conditions.push(`(
      v.summary LIKE ?
      OR v.prepared_by LIKE ?
      OR CAST(v.voucher_number AS TEXT) LIKE ?
      OR EXISTS (
        SELECT 1 FROM voucher_entries e
         WHERE e.voucher_id = v.id
           AND (e.summary LIKE ? OR e.account_name LIKE ? OR e.account_code LIKE ?)
      )
    )`);
    const like = `%${keyword.trim()}%`;
    params.push(like, like, like, like, like, like);
  }
  if (categoryId !== '' && categoryId !== null && categoryId !== undefined) {
    conditions.push('v.category_id = ?');
    params.push(Number(categoryId));
  }
  if (startDate) {
    conditions.push('v.voucher_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('v.voucher_date <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const total = database
    .prepare(`SELECT COUNT(*) AS total FROM vouchers v ${whereClause}`)
    .get(...params).total;

  const rows = database
    .prepare(
      `SELECT v.id, v.voucher_word AS voucherWord, v.voucher_number AS voucherNumber,
              v.voucher_date AS voucherDate, v.summary, v.category_id AS categoryId,
              c.name AS categoryName, c.color AS categoryColor,
              v.attachment_count AS attachmentCount,
              v.prepared_by AS preparedBy, v.reviewed_by AS reviewedBy,
              v.created_at AS createdAt, v.updated_at AS updatedAt,
              COALESCE((SELECT SUM(e.debit)  FROM voucher_entries e WHERE e.voucher_id = v.id), 0) AS totalDebit,
              COALESCE((SELECT SUM(e.credit) FROM voucher_entries e WHERE e.voucher_id = v.id), 0) AS totalCredit,
              (SELECT COUNT(*) FROM voucher_entries e WHERE e.voucher_id = v.id) AS entryCount
         FROM vouchers v
         LEFT JOIN categories c ON c.id = v.category_id
         ${whereClause}
        ORDER BY v.voucher_date DESC, v.voucher_word ASC, v.voucher_number DESC
        LIMIT ? OFFSET ?`
    )
    .all(...params, safePageSize, (safePage - 1) * safePageSize);

  return {
    items: rows,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(Math.ceil(total / safePageSize), 1),
  };
}

export function getVoucher(id) {
  const voucherId = Number(id);
  const voucher = database
    .prepare(
      `SELECT v.id, v.voucher_word AS voucherWord, v.voucher_number AS voucherNumber,
              v.voucher_date AS voucherDate, v.summary, v.category_id AS categoryId,
              c.name AS categoryName, c.color AS categoryColor,
              v.attachment_count AS attachmentCount,
              v.prepared_by AS preparedBy, v.reviewed_by AS reviewedBy,
              v.created_at AS createdAt, v.updated_at AS updatedAt
         FROM vouchers v
         LEFT JOIN categories c ON c.id = v.category_id
        WHERE v.id = ?`
    )
    .get(voucherId);

  if (!voucher) {
    return null;
  }

  voucher.entries = database
    .prepare(
      `SELECT id, line_number AS lineNumber, summary, account_code AS accountCode,
              account_name AS accountName, debit, credit
         FROM voucher_entries
        WHERE voucher_id = ?
        ORDER BY line_number ASC`
    )
    .all(voucherId);

  return voucher;
}

export function createVoucher(payload) {
  const normalized = normalizeVoucherPayload(payload);
  const voucherDate = normalized.voucherDate;
  const voucherWord = normalized.voucherWord;

  // 未指定凭证号时按「凭证字 + 日期」取当前最大号加一
  let voucherNumber = normalized.voucherNumber;
  if (!voucherNumber) {
    const maxRow = database
      .prepare('SELECT MAX(voucher_number) AS maxNumber FROM vouchers WHERE voucher_word = ? AND voucher_date = ?')
      .get(voucherWord, voucherDate);
    voucherNumber = (maxRow?.maxNumber ?? 0) + 1;
  }

  const duplicated = database
    .prepare('SELECT id FROM vouchers WHERE voucher_word = ? AND voucher_number = ? AND voucher_date = ?')
    .get(voucherWord, voucherNumber, voucherDate);
  if (duplicated) {
    throw new ValidationError(`${voucherDate} 已存在第 ${voucherNumber} 号「${voucherWord}」字凭证`);
  }

  const timestamp = nowIso();
  database.exec('BEGIN');
  try {
    const voucherId = database
      .prepare(
        `INSERT INTO vouchers
           (voucher_word, voucher_number, voucher_date, summary, category_id,
            attachment_count, prepared_by, reviewed_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        voucherWord,
        voucherNumber,
        voucherDate,
        normalized.summary,
        normalized.categoryId,
        normalized.attachmentCount,
        normalized.preparedBy,
        normalized.reviewedBy,
        timestamp,
        timestamp
      ).lastInsertRowid;

    insertEntries(voucherId, normalized.entries);
    database.exec('COMMIT');
    return getVoucher(voucherId);
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function updateVoucher(id, payload) {
  const voucherId = Number(id);
  const existing = database.prepare('SELECT id FROM vouchers WHERE id = ?').get(voucherId);
  if (!existing) {
    throw new ValidationError('凭证不存在');
  }

  const normalized = normalizeVoucherPayload(payload);

  const duplicated = database
    .prepare(
      `SELECT id FROM vouchers
        WHERE voucher_word = ? AND voucher_number = ? AND voucher_date = ? AND id <> ?`
    )
    .get(normalized.voucherWord, normalized.voucherNumber, normalized.voucherDate, voucherId);
  if (duplicated) {
    throw new ValidationError(
      `${normalized.voucherDate} 已存在第 ${normalized.voucherNumber} 号「${normalized.voucherWord}」字凭证`
    );
  }

  database.exec('BEGIN');
  try {
    database
      .prepare(
        `UPDATE vouchers
            SET voucher_word = ?, voucher_number = ?, voucher_date = ?, summary = ?,
                category_id = ?, attachment_count = ?, prepared_by = ?, reviewed_by = ?,
                updated_at = ?
          WHERE id = ?`
      )
      .run(
        normalized.voucherWord,
        normalized.voucherNumber,
        normalized.voucherDate,
        normalized.summary,
        normalized.categoryId,
        normalized.attachmentCount,
        normalized.preparedBy,
        normalized.reviewedBy,
        nowIso(),
        voucherId
      );

    // 分录整体替换，简单可靠且能正确反映行的增删
    database.prepare('DELETE FROM voucher_entries WHERE voucher_id = ?').run(voucherId);
    insertEntries(voucherId, normalized.entries);
    database.exec('COMMIT');
    return getVoucher(voucherId);
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function deleteVoucher(id) {
  const voucherId = Number(id);
  const existing = database.prepare('SELECT id FROM vouchers WHERE id = ?').get(voucherId);
  if (!existing) {
    throw new ValidationError('凭证不存在');
  }
  // 分录由 ON DELETE CASCADE 一并清理
  database.prepare('DELETE FROM vouchers WHERE id = ?').run(voucherId);
  return { id: voucherId };
}

function insertEntries(voucherId, entries) {
  const insertEntry = database.prepare(
    `INSERT INTO voucher_entries
       (voucher_id, line_number, summary, account_code, account_name, debit, credit)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  entries.forEach((entry, index) => {
    insertEntry.run(
      voucherId,
      index + 1,
      entry.summary,
      entry.accountCode,
      entry.accountName,
      entry.debit,
      entry.credit
    );
  });
}

/**
 * 校验并归一化凭证入参。
 * 会计恒等式约束：每行只能有借或贷一方有金额，且借方合计必须等于贷方合计。
 */
function normalizeVoucherPayload(payload = {}) {
  const voucherDate = String(payload.voucherDate ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(voucherDate)) {
    throw new ValidationError('凭证日期格式应为 YYYY-MM-DD');
  }

  const voucherWord = String(payload.voucherWord ?? '记').trim() || '记';
  if (voucherWord.length > 4) {
    throw new ValidationError('凭证字不能超过 4 个字符');
  }

  const rawNumber = payload.voucherNumber;
  const voucherNumber = Number(rawNumber);
  const hasNumber = rawNumber !== undefined && rawNumber !== null && rawNumber !== '';
  if (hasNumber && (!Number.isInteger(voucherNumber) || voucherNumber < 1)) {
    throw new ValidationError('凭证号必须是不小于 1 的整数');
  }

  const rawEntries = Array.isArray(payload.entries) ? payload.entries : [];
  if (rawEntries.length < 2) {
    throw new ValidationError('一张凭证至少需要两条分录');
  }

  let debitTotalCents = 0;
  let creditTotalCents = 0;

  const entries = rawEntries.map((rawEntry, index) => {
    const debitCents = centsFromAmount(rawEntry?.debit ?? 0);
    const creditCents = centsFromAmount(rawEntry?.credit ?? 0);

    if (debitCents < 0 || creditCents < 0) {
      throw new ValidationError(`第 ${index + 1} 行金额不能为负数`);
    }
    if (debitCents > 0 && creditCents > 0) {
      throw new ValidationError(`第 ${index + 1} 行不能同时填写借方和贷方金额`);
    }
    if (debitCents === 0 && creditCents === 0) {
      throw new ValidationError(`第 ${index + 1} 行必须填写借方或贷方金额`);
    }

    const accountName = String(rawEntry?.accountName ?? '').trim();
    if (!accountName) {
      throw new ValidationError(`第 ${index + 1} 行会计科目不能为空`);
    }

    debitTotalCents += debitCents;
    creditTotalCents += creditCents;

    return {
      summary: String(rawEntry?.summary ?? '').trim(),
      accountCode: String(rawEntry?.accountCode ?? '').trim(),
      accountName,
      debit: amountFromCents(debitCents),
      credit: amountFromCents(creditCents),
    };
  });

  if (debitTotalCents !== creditTotalCents) {
    throw new ValidationError(
      `借贷不平衡：借方合计 ${amountFromCents(debitTotalCents)}，贷方合计 ${amountFromCents(creditTotalCents)}`
    );
  }

  const categoryId = payload.categoryId === '' || payload.categoryId === null || payload.categoryId === undefined
    ? null
    : Number(payload.categoryId);
  if (categoryId !== null) {
    const categoryExists = database.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
    if (!categoryExists) {
      throw new ValidationError('所选分类不存在');
    }
  }

  const attachmentCount = Number(payload.attachmentCount ?? 0);
  if (!Number.isInteger(attachmentCount) || attachmentCount < 0) {
    throw new ValidationError('附单据数必须是不小于 0 的整数');
  }

  return {
    voucherWord,
    voucherNumber: hasNumber ? voucherNumber : null,
    voucherDate,
    summary: String(payload.summary ?? '').trim(),
    categoryId,
    attachmentCount,
    preparedBy: String(payload.preparedBy ?? '').trim(),
    reviewedBy: String(payload.reviewedBy ?? '').trim(),
    entries,
    debitTotalCents,
    creditTotalCents,
  };
}

/* ----------------------------------- 统计 ----------------------------------- */

export function getVoucherStats({ startDate = '', endDate = '' } = {}) {
  const conditions = [];
  const params = [];
  if (startDate) {
    conditions.push('v.voucher_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('v.voucher_date <= ?');
    params.push(endDate);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const voucherAggregate = database
    .prepare(`SELECT COUNT(*) AS voucherCount FROM vouchers v ${whereClause}`)
    .get(...params);

  const amountAggregate = database
    .prepare(
      `SELECT COALESCE(SUM(e.debit), 0) AS totalDebit, COALESCE(SUM(e.credit), 0) AS totalCredit
         FROM voucher_entries e
         JOIN vouchers v ON v.id = e.voucher_id
         ${whereClause}`
    )
    .get(...params);

  const byCategory = database
    .prepare(
      `SELECT COALESCE(c.name, '未分类') AS categoryName,
              COALESCE(c.color, '#9aa4b2') AS categoryColor,
              COUNT(v.id) AS voucherCount,
              COALESCE(SUM((SELECT SUM(e.debit) FROM voucher_entries e WHERE e.voucher_id = v.id)), 0) AS totalDebit
         FROM vouchers v
         LEFT JOIN categories c ON c.id = v.category_id
         ${whereClause}
        GROUP BY c.id
        ORDER BY totalDebit DESC`
    )
    .all(...params);

  return {
    voucherCount: voucherAggregate.voucherCount,
    totalDebit: amountFromCents(centsFromAmount(amountAggregate.totalDebit)),
    totalCredit: amountFromCents(centsFromAmount(amountAggregate.totalCredit)),
    byCategory,
  };
}
