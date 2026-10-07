/**
 * 前端主逻辑：凭证管理后台。
 * 通过 REST API 与 Node 后端通信；页面既可由后端静态托管（同源），
 * 也可在预览服务中加载（跨域到 http://localhost:4000）。
 */

/* ============================ 一、基础层 ============================ */

/** 判断 API 根地址：同源托管时用相对路径，预览环境则指向本地后端 */
function resolveApiBase() {
  const { protocol, port } = window.location;
  if (protocol === 'file:') {
    return 'http://localhost:4000';
  }
  if (port === String(BACKEND_PORT)) {
    return '';
  }
  return `http://localhost:${BACKEND_PORT}`;
}

const BACKEND_PORT = 4000;
const API_BASE = resolveApiBase();

/** 统一请求封装：自动序列化 JSON，并把后端 message 抛成 Error */
async function apiRequest(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (networkError) {
    throw new Error('无法连接后端服务，请确认已运行 npm start（端口 4000）');
  }

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('后端返回了非 JSON 响应');
    }
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message ?? `请求失败（HTTP ${response.status}）`);
  }
  return payload.data;
}

const formatAmount = (value) =>
  Number(value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);

const todayString = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const toAmount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 0;
};

/* ============================ 二、应用状态 ============================ */

const state = {
  categories: [],
  vouchers: [],
  filters: { keyword: '', categoryId: '', startDate: '', endDate: '' },
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
  editingVoucherId: null,
  detailVoucherId: null,
  editingCategoryId: null,
};

const element = (id) => document.getElementById(id);

/* ============================ 三、通用交互 ============================ */

let toastTimer = null;

/** 底部提示条，2.6 秒后自动消失 */
function showToast(message, isError = false) {
  const toast = element('toast');
  toast.textContent = message;
  toast.classList.toggle('is-error', isError);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function openModal(modalId) {
  element(modalId).hidden = false;
}

function closeModal(modalId) {
  element(modalId).hidden = true;
}

/** 统一绑定所有弹窗的关闭按钮与遮罩点击 */
function bindModalDismiss() {
  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.closeModal));
  });
  document.querySelectorAll('.modal-mask').forEach((mask) => {
    mask.addEventListener('mousedown', (event) => {
      if (event.target === mask) {
        mask.hidden = true;
      }
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal-mask').forEach((mask) => {
        mask.hidden = true;
      });
    }
  });
}

/* ============================ 四、凭证列表 ============================ */

/** 渲染分类下拉选项（筛选栏与凭证表单共用同一份数据） */
function renderCategoryOptions() {
  const buildOptions = (placeholder) =>
    [`<option value="">${placeholder}</option>`]
      .concat(
        state.categories.map(
          (category) =>
            `<option value="${category.id}">${escapeHtml(category.name)}</option>`
        )
      )
      .join('');

  const filterSelect = element('filterCategory');
  const formSelect = element('voucherCategory');
  filterSelect.innerHTML = buildOptions('全部分类');
  formSelect.innerHTML = buildOptions('未分类');

  filterSelect.value = state.filters.categoryId === '' ? '' : String(state.filters.categoryId);
  if (state.editingVoucherId && formSelect.dataset.selectedCategory) {
    formSelect.value = formSelect.dataset.selectedCategory;
  }
}

function renderTag(categoryName, categoryColor) {
  if (!categoryName) {
    return '<span class="tag tag-empty">未分类</span>';
  }
  const color = categoryColor ?? '#9aa4b2';
  return `<span class="tag" style="color:${color};background:${color}1a;border-color:${color}40">
      <i class="tag-dot"></i>${escapeHtml(categoryName)}
    </span>`;
}

function renderVoucherTable() {
  const tableBody = element('voucherTableBody');

  if (state.vouchers.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="10" class="table-empty">没有符合条件的凭证</td></tr>';
    return;
  }

  tableBody.innerHTML = state.vouchers
    .map((voucher, index) => {
      const rowNumber = (state.page - 1) * state.pageSize + index + 1;
      const isBalanced = Math.round(voucher.totalDebit * 100) === Math.round(voucher.totalCredit * 100);
      return `
        <tr>
          <td class="col-index">${rowNumber}</td>
          <td><strong>${escapeHtml(voucher.voucherWord)}-${voucher.voucherNumber}</strong></td>
          <td>${voucher.voucherDate}</td>
          <td class="col-wide">${escapeHtml(voucher.summary) || '<span class="tag-empty">—</span>'}</td>
          <td>${renderTag(voucher.categoryName, voucher.categoryColor)}</td>
          <td class="col-number">${voucher.entryCount}</td>
          <td class="col-number ${isBalanced ? 'amount-debit' : 'balance-bad'}">${formatAmount(voucher.totalDebit)}</td>
          <td class="col-number ${isBalanced ? 'amount-credit' : 'balance-bad'}">${formatAmount(voucher.totalCredit)}</td>
          <td>${escapeHtml(voucher.preparedBy) || '—'}</td>
          <td class="col-actions">
            <div class="row-actions">
              <button class="button button-small" type="button" data-action="view" data-id="${voucher.id}">查看</button>
              <button class="button button-small" type="button" data-action="edit" data-id="${voucher.id}">编辑</button>
              <button class="button button-small button-danger" type="button" data-action="delete" data-id="${voucher.id}">删除</button>
            </div>
          </td>
        </tr>`;
    })
    .join('');

  element('listSummary').textContent =
    `共 ${state.total} 张凭证，本页借方合计 ${formatAmount(
      state.vouchers.reduce((sum, item) => sum + item.totalDebit, 0)
    )}`;
}

function renderPagination() {
  element('paginationInfo').textContent = `共 ${state.total} 条记录，每页 ${state.pageSize} 条`;
  element('pageIndicator').textContent = `${state.page} / ${state.totalPages}`;
  element('buttonPrevPage').disabled = state.page <= 1;
  element('buttonNextPage').disabled = state.page >= state.totalPages;
}

async function loadVouchers() {
  const query = new URLSearchParams({
    keyword: state.filters.keyword,
    categoryId: state.filters.categoryId === '' ? '' : String(state.filters.categoryId),
    startDate: state.filters.startDate,
    endDate: state.filters.endDate,
    page: String(state.page),
    pageSize: String(state.pageSize),
  });

  try {
    const data = await apiRequest(`/api/vouchers?${query.toString()}`);
    state.vouchers = data.items;
    state.total = data.total;
    state.totalPages = data.totalPages;
    if (state.page > state.totalPages) {
      state.page = state.totalPages;
      await loadVouchers();
      return;
    }
    renderVoucherTable();
    renderPagination();
  } catch (error) {
    element('voucherTableBody').innerHTML =
      `<tr><td colspan="10" class="table-empty">加载失败：${escapeHtml(error.message)}</td></tr>`;
    showToast(error.message, true);
  }
}

async function loadStats() {
  try {
    const stats = await apiRequest(
      `/api/stats?startDate=${encodeURIComponent(state.filters.startDate)}&endDate=${encodeURIComponent(
        state.filters.endDate
      )}`
    );

    element('statVoucherCount').textContent = stats.voucherCount;
    element('statTotalDebit').textContent = `¥${formatAmount(stats.totalDebit)}`;
    element('statTotalCredit').textContent = `¥${formatAmount(stats.totalCredit)}`;

    const isBalanced = Math.round(stats.totalDebit * 100) === Math.round(stats.totalCredit * 100);
    const balanceElement = element('statBalance');
    balanceElement.textContent = isBalanced ? '借贷平衡' : '借贷不平';
    balanceElement.className = `stat-value ${isBalanced ? 'balance-ok' : 'balance-bad'}`;

    element('sidebarVoucherCount').textContent = stats.voucherCount;
    element('sidebarTotalDebit').textContent = `¥${formatAmount(stats.totalDebit)}`;
    element('sidebarTotalCredit').textContent = `¥${formatAmount(stats.totalCredit)}`;
  } catch (error) {
    showToast(`统计加载失败：${error.message}`, true);
  }
}

async function loadCategories() {
  state.categories = await apiRequest('/api/categories');
  renderCategoryOptions();
  renderCategoryTable();
}

/** 同步刷新列表与统计 */
async function refreshVoucherData() {
  await Promise.all([loadVouchers(), loadStats()]);
}

function bindVoucherListEvents() {
  element('filterForm').addEventListener('submit', (event) => {
    event.preventDefault();
    state.filters = {
      keyword: element('filterKeyword').value.trim(),
      categoryId: element('filterCategory').value,
      startDate: element('filterStartDate').value,
      endDate: element('filterEndDate').value,
    };
    state.page = 1;
    refreshVoucherData();
  });

  element('buttonResetFilter').addEventListener('click', () => {
    element('filterForm').reset();
    state.filters = { keyword: '', categoryId: '', startDate: '', endDate: '' };
    state.page = 1;
    refreshVoucherData();
  });

  element('pageSizeSelect').addEventListener('change', (event) => {
    state.pageSize = Number(event.target.value);
    state.page = 1;
    loadVouchers();
  });

  element('buttonPrevPage').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      loadVouchers();
    }
  });

  element('buttonNextPage').addEventListener('click', () => {
    if (state.page < state.totalPages) {
      state.page += 1;
      loadVouchers();
    }
  });

  element('voucherTableBody').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    const voucherId = Number(button.dataset.id);
    const action = button.dataset.action;

    if (action === 'view') {
      openVoucherDetail(voucherId);
    } else if (action === 'edit') {
      openVoucherEditor(voucherId);
    } else if (action === 'delete') {
      await deleteVoucher(voucherId);
    }
  });
}
/* ============================ 五、凭证编辑与详情 ============================ */

const emptyEntry = () => ({ summary: '', accountCode: '', accountName: '', debit: '', credit: '' });

function createEntryRow(entry) {
  const row = document.createElement('tr');
  row.className = 'entry-row';
  row.innerHTML = `
    <td class="col-index entry-line-number"></td>
    <td><input type="text" data-field="summary" placeholder="摘要" value="${escapeHtml(entry.summary)}"></td>
    <td><input type="text" data-field="accountCode" placeholder="如 1002" value="${escapeHtml(entry.accountCode)}"></td>
    <td><input type="text" data-field="accountName" placeholder="如 银行存款" value="${escapeHtml(entry.accountName)}"></td>
    <td class="col-number"><input type="number" data-field="debit" min="0" step="0.01" placeholder="0.00" value="${entry.debit}"></td>
    <td class="col-number"><input type="number" data-field="credit" min="0" step="0.01" placeholder="0.00" value="${entry.credit}"></td>
    <td class="col-actions"><button class="icon-button" type="button" data-action="remove-entry" aria-label="删除该行">✕</button></td>
  `;
  return row;
}

/** 重排分录行序号，删除后保持连续 */
function renumberEntryRows() {
  element('entryTableBody').querySelectorAll('.entry-row').forEach((row, index) => {
    row.querySelector('.entry-line-number').textContent = index + 1;
  });
}

function renderEntryRows(entries) {
  const tableBody = element('entryTableBody');
  tableBody.innerHTML = '';
  entries.forEach((entry) => tableBody.appendChild(createEntryRow(entry)));
  renumberEntryRows();
  recalculateEntryTotals();
}

function addEntryRow(entry = emptyEntry()) {
  element('entryTableBody').appendChild(createEntryRow(entry));
  renumberEntryRows();
  recalculateEntryTotals();
}

/** 实时汇总借贷金额并给出平衡提示 */
function recalculateEntryTotals() {
  let debitTotal = 0;
  let creditTotal = 0;

  element('entryTableBody').querySelectorAll('.entry-row').forEach((row) => {
    debitTotal += toAmount(row.querySelector('[data-field="debit"]').value);
    creditTotal += toAmount(row.querySelector('[data-field="credit"]').value);
  });

  element('entryDebitTotal').textContent = formatAmount(debitTotal);
  element('entryCreditTotal').textContent = formatAmount(creditTotal);

  const hint = element('balanceHint');
  const balanced = Math.round(debitTotal * 100) === Math.round(creditTotal * 100) && debitTotal > 0;
  hint.classList.toggle('is-unbalanced', !balanced);
  hint.textContent = balanced
    ? `借贷平衡：合计 ¥${formatAmount(debitTotal)}`
    : `借贷不平衡：借方 ¥${formatAmount(debitTotal)}，贷方 ¥${formatAmount(creditTotal)}，差额 ¥${formatAmount(
        Math.abs(debitTotal - creditTotal)
      )}`;
}

function collectVoucherFormData() {
  const entries = [];
  element('entryTableBody').querySelectorAll('.entry-row').forEach((row) => {
    const readField = (fieldName) => row.querySelector(`[data-field="${fieldName}"]`).value.trim();
    entries.push({
      summary: readField('summary'),
      accountCode: readField('accountCode'),
      accountName: readField('accountName'),
      debit: toAmount(readField('debit')),
      credit: toAmount(readField('credit')),
    });
  });

  return {
    voucherWord: element('voucherWord').value.trim() || '记',
    voucherNumber: element('voucherNumber').value === '' ? null : Number(element('voucherNumber').value),
    voucherDate: element('voucherDate').value,
    summary: element('voucherSummary').value.trim(),
    categoryId: element('voucherCategory').value === '' ? null : Number(element('voucherCategory').value),
    attachmentCount: Number(element('voucherAttachmentCount').value || 0),
    preparedBy: element('voucherPreparedBy').value.trim(),
    reviewedBy: element('voucherReviewedBy').value.trim(),
    entries,
  };
}

/** 打开编辑器：传入 id 为编辑，不传为新建 */
async function openVoucherEditor(voucherId = null) {
  state.editingVoucherId = voucherId;
  element('voucherFormError').hidden = true;
  element('voucherForm').reset();
  element('voucherCategory').dataset.selectedCategory = '';

  if (voucherId === null) {
    element('voucherModalTitle').textContent = '新建凭证';
    element('voucherDate').value = todayString();
    element('voucherWord').value = '记';
    element('voucherAttachmentCount').value = 0;
    element('voucherCategory').value = '';
    renderEntryRows([emptyEntry(), emptyEntry()]);
    openModal('voucherModal');
    return;
  }

  try {
    const voucher = await apiRequest(`/api/vouchers/${voucherId}`);
    element('voucherModalTitle').textContent = `编辑凭证 ${voucher.voucherWord}-${voucher.voucherNumber}`;
    element('voucherDate').value = voucher.voucherDate;
    element('voucherWord').value = voucher.voucherWord;
    element('voucherNumber').value = voucher.voucherNumber;
    element('voucherSummary').value = voucher.summary;
    element('voucherAttachmentCount').value = voucher.attachmentCount;
    element('voucherPreparedBy').value = voucher.preparedBy;
    element('voucherReviewedBy').value = voucher.reviewedBy;
    element('voucherCategory').dataset.selectedCategory = voucher.categoryId === null ? '' : String(voucher.categoryId);
    element('voucherCategory').value = voucher.categoryId === null ? '' : String(voucher.categoryId);
    renderEntryRows(
      voucher.entries.map((entry) => ({
        summary: entry.summary,
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        debit: entry.debit || '',
        credit: entry.credit || '',
      }))
    );
    openModal('voucherModal');
  } catch (error) {
    showToast(error.message, true);
  }
}

/** 客户端先做一次友好校验，真正的权威校验仍在后端 */
function validateBeforeSave(payload) {
  if (!payload.voucherDate) {
    return '请选择记账日期';
  }
  if (payload.entries.length < 2) {
    return '一张凭证至少需要两条分录';
  }
  for (let index = 0; index < payload.entries.length; index += 1) {
    const entry = payload.entries[index];
    if (!entry.accountName) {
      return `第 ${index + 1} 行会计科目不能为空`;
    }
    if (entry.debit > 0 && entry.credit > 0) {
      return `第 ${index + 1} 行不能同时填写借方和贷方金额`;
    }
    if (entry.debit === 0 && entry.credit === 0) {
      return `第 ${index + 1} 行必须填写借方或贷方金额`;
    }
  }
  const debitTotal = Math.round(payload.entries.reduce((sum, item) => sum + item.debit, 0) * 100);
  const creditTotal = Math.round(payload.entries.reduce((sum, item) => sum + item.credit, 0) * 100);
  if (debitTotal !== creditTotal) {
    return '借贷不平衡，请检查分录金额';
  }
  return '';
}

async function saveVoucher() {
  const payload = collectVoucherFormData();
  const validationMessage = validateBeforeSave(payload);
  const errorElement = element('voucherFormError');

  if (validationMessage) {
    errorElement.textContent = validationMessage;
    errorElement.hidden = false;
    return;
  }
  errorElement.hidden = true;

  const saveButton = element('buttonSaveVoucher');
  saveButton.disabled = true;
  saveButton.textContent = '保存中…';

  try {
    if (state.editingVoucherId === null) {
      await apiRequest('/api/vouchers', { method: 'POST', body: payload });
      showToast('凭证创建成功');
    } else {
      await apiRequest(`/api/vouchers/${state.editingVoucherId}`, { method: 'PUT', body: payload });
      showToast('凭证已更新');
    }
    closeModal('voucherModal');
    await refreshVoucherData();
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.hidden = false;
    showToast(error.message, true);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = '保存凭证';
  }
}

async function deleteVoucher(voucherId) {
  const voucher = state.vouchers.find((item) => item.id === voucherId);
  const label = voucher ? `「${voucher.voucherWord}-${voucher.voucherNumber} ${voucher.summary || '无摘要'}」` : '';
  if (!window.confirm(`确定删除凭证 ${label} 吗？该操作不可撤销。`)) {
    return;
  }
  try {
    await apiRequest(`/api/vouchers/${voucherId}`, { method: 'DELETE' });
    showToast('凭证已删除');
    await refreshVoucherData();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function openVoucherDetail(voucherId) {
  try {
    const voucher = await apiRequest(`/api/vouchers/${voucherId}`);
    state.detailVoucherId = voucherId;

    const entryRows = voucher.entries
      .map(
        (entry) => `
        <tr>
          <td class="col-index">${entry.lineNumber}</td>
          <td class="col-wide">${escapeHtml(entry.summary) || '—'}</td>
          <td>${escapeHtml(entry.accountCode) || '—'}</td>
          <td>${escapeHtml(entry.accountName)}</td>
          <td class="col-number amount-debit">${entry.debit ? formatAmount(entry.debit) : ''}</td>
          <td class="col-number amount-credit">${entry.credit ? formatAmount(entry.credit) : ''}</td>
        </tr>`
      )
      .join('');

    element('detailBody').innerHTML = `
      <div class="detail-grid">
        <div class="detail-item"><span>凭证字号</span><strong>${escapeHtml(voucher.voucherWord)}-${voucher.voucherNumber}</strong></div>
        <div class="detail-item"><span>记账日期</span><strong>${voucher.voucherDate}</strong></div>
        <div class="detail-item"><span>分类标签</span><strong>${renderTag(voucher.categoryName, voucher.categoryColor)}</strong></div>
        <div class="detail-item"><span>附单据数</span><strong>${voucher.attachmentCount}</strong></div>
        <div class="detail-item"><span>制单人</span><strong>${escapeHtml(voucher.preparedBy) || '—'}</strong></div>
        <div class="detail-item"><span>审核人</span><strong>${escapeHtml(voucher.reviewedBy) || '—'}</strong></div>
        <div class="detail-item detail-full"><span>摘要</span><strong>${escapeHtml(voucher.summary) || '—'}</strong></div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-index">#</th>
              <th class="col-wide">摘要</th>
              <th>科目编码</th>
              <th>会计科目</th>
              <th class="col-number">借方金额</th>
              <th class="col-number">贷方金额</th>
            </tr>
          </thead>
          <tbody>${entryRows}</tbody>
        </table>
      </div>`;

    openModal('detailModal');
  } catch (error) {
    showToast(error.message, true);
  }
}

function bindVoucherEditorEvents() {
  element('buttonCreateVoucher').addEventListener('click', () => openVoucherEditor(null));
  element('buttonAddEntry').addEventListener('click', () => addEntryRow());
  element('buttonSaveVoucher').addEventListener('click', saveVoucher);

  element('entryTableBody').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="remove-entry"]');
    if (!button) {
      return;
    }
    const rows = element('entryTableBody').querySelectorAll('.entry-row');
    if (rows.length <= 2) {
      showToast('至少保留两条分录', true);
      return;
    }
    button.closest('.entry-row').remove();
    renumberEntryRows();
    recalculateEntryTotals();
  });

  // 输入金额时实时刷新合计；借方与贷方互斥，避免同一行填两次
  element('entryTableBody').addEventListener('input', (event) => {
    const input = event.target;
    if (input.dataset.field === 'debit' && toAmount(input.value) > 0) {
      input.closest('.entry-row').querySelector('[data-field="credit"]').value = '';
    } else if (input.dataset.field === 'credit' && toAmount(input.value) > 0) {
      input.closest('.entry-row').querySelector('[data-field="debit"]').value = '';
    }
    recalculateEntryTotals();
  });

  element('buttonDetailEdit').addEventListener('click', () => {
    const voucherId = state.detailVoucherId;
    closeModal('detailModal');
    openVoucherEditor(voucherId);
  });
}
/* ============================ 六、分类标签 ============================ */

function renderCategoryTable() {
  const tableBody = element('categoryTableBody');
  element('categorySummary').textContent = `共 ${state.categories.length} 个分类`;

  if (state.categories.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="table-empty">暂无分类标签，请先添加</td></tr>';
    return;
  }

  tableBody.innerHTML = state.categories
    .map((category, index) => {
      const isEditing = state.editingCategoryId === category.id;
      return `
        <tr>
          <td class="col-index">${index + 1}</td>
          <td>${
            isEditing
              ? `<input type="text" data-field="category-name" maxlength="30" value="${escapeHtml(category.name)}">`
              : escapeHtml(category.name)
          }</td>
          <td>${
            isEditing
              ? `<input type="color" data-field="category-color" value="${escapeHtml(category.color)}">`
              : renderTag(category.name, category.color)
          }</td>
          <td class="col-number">${category.voucherCount}</td>
          <td class="col-actions">
            <div class="row-actions">
              ${
                isEditing
                  ? `<button class="button button-small button-primary" type="button" data-action="save-category" data-id="${category.id}">保存</button>
                     <button class="button button-small" type="button" data-action="cancel-category">取消</button>`
                  : `<button class="button button-small" type="button" data-action="edit-category" data-id="${category.id}">编辑</button>
                     <button class="button button-small button-danger" type="button" data-action="delete-category" data-id="${category.id}">删除</button>`
              }
            </div>
          </td>
        </tr>`;
    })
    .join('');
}

async function createCategory(event) {
  event.preventDefault();
  const nameInput = element('categoryName');
  try {
    await apiRequest('/api/categories', {
      method: 'POST',
      body: { name: nameInput.value.trim(), color: element('categoryColor').value },
    });
    nameInput.value = '';
    showToast('分类已添加');
    await loadCategories();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function saveCategory(categoryId) {
  const rowElement = element('categoryTableBody').querySelector(`button[data-id="${categoryId}"]`)?.closest('tr');
  if (!rowElement) {
    return;
  }
  const name = rowElement.querySelector('[data-field="category-name"]').value.trim();
  const color = rowElement.querySelector('[data-field="category-color"]').value;

  try {
    await apiRequest(`/api/categories/${categoryId}`, { method: 'PUT', body: { name, color } });
    state.editingCategoryId = null;
    showToast('分类已更新');
    await loadCategories();
    await refreshVoucherData();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function deleteCategory(categoryId) {
  const category = state.categories.find((item) => item.id === categoryId);
  if (!category) {
    return;
  }
  const warning = category.voucherCount > 0
    ? `分类「${category.name}」下仍有 ${category.voucherCount} 张凭证，删除后这些凭证将变为「未分类」，是否继续？`
    : `确定删除分类「${category.name}」吗？`;
  if (!window.confirm(warning)) {
    return;
  }
  try {
    await apiRequest(`/api/categories/${categoryId}`, { method: 'DELETE' });
    showToast('分类已删除');
    await loadCategories();
    await refreshVoucherData();
  } catch (error) {
    showToast(error.message, true);
  }
}

function bindCategoryEvents() {
  element('categoryForm').addEventListener('submit', createCategory);

  element('categoryTableBody').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    const categoryId = Number(button.dataset.id);
    const action = button.dataset.action;

    if (action === 'edit-category') {
      state.editingCategoryId = categoryId;
      renderCategoryTable();
    } else if (action === 'cancel-category') {
      state.editingCategoryId = null;
      renderCategoryTable();
    } else if (action === 'save-category') {
      saveCategory(categoryId);
    } else if (action === 'delete-category') {
      deleteCategory(categoryId);
    }
  });

  // 编辑态输入回车即保存
  element('categoryTableBody').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.dataset.field === 'category-name') {
      event.preventDefault();
      const categoryId = Number(event.target.closest('tr').querySelector('[data-action="save-category"]').dataset.id);
      saveCategory(categoryId);
    }
  });
}

/* ============================ 七、视图切换与初始化 ============================ */

function switchView(viewName) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.view === viewName);
  });
  element('viewVouchers').classList.toggle('is-active', viewName === 'vouchers');
  element('viewCategories').classList.toggle('is-active', viewName === 'categories');
  if (viewName === 'categories') {
    loadCategories().catch((error) => showToast(error.message, true));
  }
}

function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });
}

async function initializeApplication() {
  bindModalDismiss();
  bindNavigation();
  bindVoucherListEvents();
  bindVoucherEditorEvents();
  bindCategoryEvents();

  try {
    await loadCategories();
    await refreshVoucherData();
  } catch (error) {
    showToast(`初始化失败：${error.message}`, true);
  }
}

initializeApplication();
