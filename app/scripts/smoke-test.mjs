/**
 * API 冒烟测试：覆盖正常路径、业务校验与安全防护。
 * 运行：node scripts/smoke-test.mjs   （需先启动 node server/index.js）
 */
// 使用专属变量名，避免被外部环境里同名的 BASE_URL 污染而打到其它服务
const BASE_URL = process.env.VOUCHER_TEST_BASE_URL ?? 'http://localhost:4000';

let passedCount = 0;
let failedCount = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passedCount += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failedCount += 1;
    console.log(`  ❌ ${name}${detail ? ` → ${detail}` : ''}`);
  }
}

async function request(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed };
}

const validVoucher = (overrides = {}) => ({
  voucherWord: '记',
  voucherDate: '2024-07-01',
  summary: '采购原材料',
  categoryId: null,
  attachmentCount: 3,
  preparedBy: '王会计',
  reviewedBy: '李主管',
  entries: [
    { summary: '采购原材料', accountCode: '1403', accountName: '原材料', debit: 12000, credit: 0 },
    { summary: '采购原材料', accountCode: '1002', accountName: '银行存款', debit: 0, credit: 12000 },
  ],
  ...overrides,
});

console.log(`\n=== 凭证管理系统 API 冒烟测试 @ ${BASE_URL} ===\n`);

console.log('[1] 健康检查与查询');
const health = await request('GET', '/api/health');
check('健康检查返回 200', health.status === 200, `status=${health.status}`);

const initialList = await request('GET', '/api/vouchers?pageSize=100');
const initialTotal = initialList.body?.data?.total;
check('凭证列表可查询', initialList.status === 200 && Array.isArray(initialList.body.data.items));
check('种子凭证已初始化', initialTotal >= 2, `total=${initialTotal}`);

console.log('\n[2] 创建凭证');
const created = await request('POST', '/api/vouchers', validVoucher());
check('合法凭证创建成功', created.status === 201, `status=${created.status} ${JSON.stringify(created.body)}`);
const createdId = created.body?.data?.id;
check('凭证号自动生成', created.body?.data?.voucherNumber >= 1, `number=${created.body?.data?.voucherNumber}`);
check('返回两条分录', created.body?.data?.entries?.length === 2);

const afterCreate = await request('GET', '/api/vouchers?pageSize=100');
check('凭证总数加一', afterCreate.body?.data?.total === initialTotal + 1);

console.log('\n[3] 业务校验（借贷平衡与科目）');
const unbalanced = await request('POST', '/api/vouchers', validVoucher({
  voucherDate: '2024-07-02',
  entries: [
    { summary: '测试', accountCode: '1403', accountName: '原材料', debit: 100, credit: 0 },
    { summary: '测试', accountCode: '1002', accountName: '银行存款', debit: 0, credit: 90 },
  ],
}));
check('借贷不平衡被拒绝', unbalanced.status === 400 && /借贷不平衡/.test(unbalanced.body.message ?? ''),
  `status=${unbalanced.status} msg=${unbalanced.body.message}`);

const bothSides = await request('POST', '/api/vouchers', validVoucher({
  voucherDate: '2024-07-02',
  entries: [
    { summary: '测试', accountCode: '1403', accountName: '原材料', debit: 100, credit: 100 },
    { summary: '测试', accountCode: '1002', accountName: '银行存款', debit: 0, credit: 100 },
  ],
}));
check('同行双向金额被拒绝', bothSides.status === 400 && /同时填写/.test(bothSides.body.message ?? ''),
  `msg=${bothSides.body.message}`);

const tooFewEntries = await request('POST', '/api/vouchers', validVoucher({
  voucherDate: '2024-07-02',
  entries: [{ summary: '测试', accountCode: '1403', accountName: '原材料', debit: 100, credit: 0 }],
}));
check('分录少于两条被拒绝', tooFewEntries.status === 400, `msg=${tooFewEntries.body.message}`);

const blankAccount = await request('POST', '/api/vouchers', validVoucher({
  voucherDate: '2024-07-02',
  entries: [
    { summary: '测试', accountCode: '1403', accountName: '  ', debit: 100, credit: 0 },
    { summary: '测试', accountCode: '1002', accountName: '银行存款', debit: 0, credit: 100 },
  ],
}));
check('空会计科目被拒绝', blankAccount.status === 400, `msg=${blankAccount.body.message}`);

const badDate = await request('POST', '/api/vouchers', validVoucher({ voucherDate: '2024/07/02' }));
check('非法日期格式被拒绝', badDate.status === 400, `msg=${badDate.body.message}`);

const duplicateNumber = await request('POST', '/api/vouchers',
  validVoucher({ voucherNumber: created.body?.data?.voucherNumber, voucherDate: '2024-07-01' }));
check('重复凭证号被拒绝', duplicateNumber.status === 400, `msg=${duplicateNumber.body.message}`);

console.log('\n[4] 更新与回滚');
const updated = await request('PUT', `/api/vouchers/${createdId}`, validVoucher({
  voucherNumber: created.body?.data?.voucherNumber,
  summary: '采购原材料（已修正）',
  entries: [
    { summary: '采购原材料', accountCode: '1403', accountName: '原材料', debit: 8888.88, credit: 0 },
    { summary: '采购原材料', accountCode: '1002', accountName: '银行存款', debit: 0, credit: 8888.88 },
  ],
}));
check('凭证更新成功', updated.status === 200 && updated.body?.data?.summary === '采购原材料（已修正）',
  `status=${updated.status} msg=${updated.body.message}`);
check('分录金额已更新', updated.body?.data?.entries?.[0]?.debit === 8888.88,
  `debit=${updated.body?.data?.entries?.[0]?.debit}`);

const rollbackAttempt = await request('PUT', `/api/vouchers/${createdId}`, validVoucher({
  voucherNumber: created.body?.data?.voucherNumber,
  summary: '不应被保存',
  entries: [
    { summary: '测试', accountCode: '1403', accountName: '原材料', debit: 10, credit: 0 },
    { summary: '测试', accountCode: '1002', accountName: '银行存款', debit: 0, credit: 5 },
  ],
}));
check('非法更新被拒绝', rollbackAttempt.status === 400);

const afterRollback = await request('GET', `/api/vouchers/${createdId}`);
check('原数据未被污染（事务回滚生效）',
  afterRollback.body?.data?.summary === '采购原材料（已修正）',
  `summary=${afterRollback.body?.data?.summary}`);

console.log('\n[5] 查询筛选');
const keywordSearch = await request('GET', '/api/vouchers?keyword=水电费&pageSize=50');
check('关键字搜索命中分录摘要',
  keywordSearch.body?.data?.items?.some((item) => item.summary === '支付办公室水电费'),
  `total=${keywordSearch.body?.data?.total}`);

const dateFiltered = await request('GET', '/api/vouchers?startDate=2024-07-01&endDate=2024-07-31&pageSize=50');
check('日期区间筛选生效',
  dateFiltered.body?.data?.items?.every((item) => item.voucherDate >= '2024-07-01' && item.voucherDate <= '2024-07-31'),
  `total=${dateFiltered.body?.data?.total}`);

const emptySearch = await request('GET', '/api/vouchers?keyword=不存在的摘要xyz&pageSize=50');
check('无匹配返回空列表', emptySearch.body?.data?.total === 0);

console.log('\n[6] 分类标签');
const newCategory = await request('POST', '/api/categories', { name: '测试分类', color: '#123456' });
check('分类创建成功', newCategory.status === 201, `status=${newCategory.status} msg=${newCategory.body.message}`);
const categoryId = newCategory.body?.data?.id;

const duplicateCategory = await request('POST', '/api/categories', { name: '测试分类' });
check('重名分类被拒绝', duplicateCategory.status === 400);

const renamedCategory = await request('PUT', `/api/categories/${categoryId}`, { name: '测试分类已改名', color: '#654321' });
check('分类更新成功', renamedCategory.status === 200 && renamedCategory.body?.data?.name === '测试分类已改名');

const taggedVoucher = await request('POST', '/api/vouchers', validVoucher({
  voucherDate: '2024-08-01', categoryId, summary: '带分类的凭证',
}));
check('凭证可绑定分类', taggedVoucher.status === 201 && taggedVoucher.body?.data?.categoryId === categoryId,
  `status=${taggedVoucher.status} categoryId=${taggedVoucher.body?.data?.categoryId}`);

const filteredByCategory = await request('GET', `/api/vouchers?categoryId=${categoryId}&pageSize=50`);
check('按分类筛选命中', filteredByCategory.body?.data?.total === 1, `total=${filteredByCategory.body?.data?.total}`);

const deletedCategory = await request('DELETE', `/api/categories/${categoryId}`);
check('分类删除成功', deletedCategory.status === 200);

const voucherAfterCategoryDelete = await request('GET', `/api/vouchers/${taggedVoucher.body?.data?.id}`);
check('删除分类后凭证保留且分类置空（外键 SET NULL）',
  voucherAfterCategoryDelete.body?.data?.categoryId === null,
  `categoryId=${voucherAfterCategoryDelete.body?.data?.categoryId}`);

const foreignKeyCheck = await request('POST', '/api/vouchers', validVoucher({ voucherDate: '2024-09-01', categoryId: 999999 }));
check('引用不存在的分类被拒绝', foreignKeyCheck.status === 400, `msg=${foreignKeyCheck.body.message}`);

console.log('\n[7] 统计');
const stats = await request('GET', '/api/stats');
check('统计接口可用', stats.status === 200
  && typeof stats.body?.data?.voucherCount === 'number'
  && typeof stats.body?.data?.totalDebit === 'number');
check('借贷合计相等（会计恒等式）',
  stats.status === 200
  && typeof stats.body?.data?.totalDebit === 'number'
  && stats.body.data.totalDebit === stats.body.data.totalCredit,
  `借方=${stats.body?.data?.totalDebit} 贷方=${stats.body?.data?.totalCredit}`);

console.log('\n[8] 删除与安全');
const deletedVoucher = await request('DELETE', `/api/vouchers/${taggedVoucher.body?.data?.id}`);
check('凭证删除成功', deletedVoucher.status === 200);

const missingVoucher = await request('DELETE', '/api/vouchers/999999');
check('删除不存在的凭证被拒绝', missingVoucher.status === 400);

const entriesCleanup = await request('GET', `/api/vouchers/${createdId}`);
check('未删除的凭证仍可读取', entriesCleanup.status === 200);

const traversal = await fetch(`${BASE_URL}/../package.json`);
check('目录穿越被拦截', traversal.status === 403 || traversal.status === 404, `status=${traversal.status}`);

const cleanup = await request('DELETE', `/api/vouchers/${createdId}`);
check('测试凭证清理完成', cleanup.status === 200);

const finalList = await request('GET', '/api/vouchers?pageSize=100');
check('数据回到初始状态', typeof initialTotal === 'number' && finalList.body?.data?.total === initialTotal,
  `initial=${initialTotal} final=${finalList.body?.data?.total}`);

console.log(`\n=== 测试完成：通过 ${passedCount} 项，失败 ${failedCount} 项 ===\n`);
process.exit(failedCount === 0 ? 0 : 1);
