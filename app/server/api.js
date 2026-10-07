/**
 * API 路由层：解析请求路径与查询参数，调用 store 并统一输出 JSON 响应。
 * 约定：成功 { success: true, data }；失败 { success: false, message }。
 */
import {
  ValidationError,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listVouchers,
  getVoucher,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  getVoucherStats,
} from './store.js';

const MAX_BODY_BYTES = 1_000_000; // 单次请求体上限 1MB，防止超大载荷

/** 读取并解析请求体，超限或非法 JSON 时抛出 ValidationError */
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let receivedBytes = 0;

    request.on('data', (chunk) => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_BODY_BYTES) {
        reject(new ValidationError('请求体过大'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new ValidationError('请求体不是合法的 JSON'));
      }
    });

    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

/**
 * 处理 /api 前缀的请求。
 * @returns {Promise<boolean>} 是否已由本模块处理（false 表示交由静态资源处理）
 */
export async function handleApiRequest(request, response, requestUrl) {
  const { pathname, searchParams } = requestUrl;
  if (!pathname.startsWith('/api/')) {
    return false;
  }

  try {
    const segments = pathname.split('/').filter(Boolean); // ['api', 'vouchers', '3']
    const resource = segments[1];
    const resourceId = segments[2];
    const method = request.method ?? 'GET';

    if (resource === 'health') {
      sendJson(response, 200, { success: true, data: { status: 'ok', time: new Date().toISOString() } });
      return true;
    }

    if (resource === 'categories') {
      await handleCategories(method, resourceId, request, response);
      return true;
    }

    if (resource === 'vouchers') {
      await handleVouchers(method, resourceId, request, response, searchParams);
      return true;
    }

    if (resource === 'stats' && method === 'GET') {
      sendJson(response, 200, {
        success: true,
        data: getVoucherStats({
          startDate: searchParams.get('startDate') ?? '',
          endDate: searchParams.get('endDate') ?? '',
        }),
      });
      return true;
    }

    sendJson(response, 404, { success: false, message: `未知接口：${method} ${pathname}` });
    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      sendJson(response, 400, { success: false, message: error.message });
      return true;
    }
    console.error('[api] 服务端异常：', error);
    sendJson(response, 500, { success: false, message: '服务器内部错误' });
    return true;
  }
}

async function handleCategories(method, categoryId, request, response) {
  if (method === 'GET') {
    sendJson(response, 200, { success: true, data: listCategories() });
    return;
  }
  if (method === 'POST') {
    const body = await readJsonBody(request);
    sendJson(response, 201, { success: true, data: createCategory(body) });
    return;
  }
  if (method === 'PUT' && categoryId) {
    const body = await readJsonBody(request);
    sendJson(response, 200, { success: true, data: updateCategory(categoryId, body) });
    return;
  }
  if (method === 'DELETE' && categoryId) {
    sendJson(response, 200, { success: true, data: deleteCategory(categoryId) });
    return;
  }
  sendJson(response, 405, { success: false, message: '不支持的操作' });
}

async function handleVouchers(method, voucherId, request, response, searchParams) {
  if (method === 'GET' && !voucherId) {
    sendJson(response, 200, {
      success: true,
      data: listVouchers({
        keyword: searchParams.get('keyword') ?? '',
        categoryId: searchParams.get('categoryId') ?? '',
        startDate: searchParams.get('startDate') ?? '',
        endDate: searchParams.get('endDate') ?? '',
        page: searchParams.get('page') ?? 1,
        pageSize: searchParams.get('pageSize') ?? 10,
      }),
    });
    return;
  }

  if (method === 'GET' && voucherId) {
    const voucher = getVoucher(voucherId);
    if (!voucher) {
      sendJson(response, 404, { success: false, message: '凭证不存在' });
      return;
    }
    sendJson(response, 200, { success: true, data: voucher });
    return;
  }

  if (method === 'POST') {
    const body = await readJsonBody(request);
    sendJson(response, 201, { success: true, data: createVoucher(body) });
    return;
  }

  if (method === 'PUT' && voucherId) {
    const body = await readJsonBody(request);
    sendJson(response, 200, { success: true, data: updateVoucher(voucherId, body) });
    return;
  }

  if (method === 'DELETE' && voucherId) {
    sendJson(response, 200, { success: true, data: deleteVoucher(voucherId) });
    return;
  }

  sendJson(response, 405, { success: false, message: '不支持的操作' });
}
