import { Router } from 'express';
import { ok, ApiError } from '../utils/response.js';
import {
  listDestinations,
  getDestination,
  createDestination,
  deleteDestination,
  listMessages,
  toPublicMessage,
} from '../store/collections.js';
import { validateDestination } from '../middleware/validate.js';

const router = Router();

/** 解析并约束分页参数 */
function parsePaging(query) {
  const limitRaw = Number.parseInt(query.limit ?? '50', 10);
  const offsetRaw = Number.parseInt(query.offset ?? '0', 10);
  const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(limitRaw, 1), 100);
  const offset = Number.isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0);
  return { limit, offset };
}

/**
 * GET /api/destinations
 * 支持 q / tag / region / country / featured / sort / limit / offset
 */
router.get('/', (req, res) => {
  const { limit, offset } = parsePaging(req.query);
  const featured =
    req.query.featured === 'true'
      ? true
      : req.query.featured === 'false'
        ? false
        : undefined;

  const result = listDestinations({
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    tag: typeof req.query.tag === 'string' ? req.query.tag : undefined,
    region: typeof req.query.region === 'string' ? req.query.region : undefined,
    country: typeof req.query.country === 'string' ? req.query.country : undefined,
    featured,
    sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
    limit,
    offset,
  });

  res.json(ok(result));
});

/**
 * GET /api/destinations/:id/messages
 */
router.get('/:id/messages', (req, res, next) => {
  const destination = getDestination(req.params.id);
  if (!destination) {
    return next(ApiError.notFound('目的地不存在'));
  }
  const { limit, offset } = parsePaging(req.query);
  const { total, items } = listMessages(req.params.id, { limit, offset });
  return res.json(
    ok({ total, items: items.map((m) => toPublicMessage(m)) })
  );
});

/**
 * GET /api/destinations/:id
 */
router.get('/:id', (req, res, next) => {
  const destination = getDestination(req.params.id);
  if (!destination) {
    return next(ApiError.notFound('目的地不存在'));
  }
  return res.json(ok(destination));
});

/**
 * POST /api/destinations
 */
router.post('/', validateDestination, (req, res) => {
  const created = createDestination(req.validated);
  res.status(201).json(ok(created));
});

/**
 * DELETE /api/destinations/:id（级联删除其留言）
 */
router.delete('/:id', (req, res, next) => {
  const removed = deleteDestination(req.params.id);
  if (!removed) {
    return next(ApiError.notFound('目的地不存在'));
  }
  return res.json(ok({ id: req.params.id }));
});

export default router;
