import { Router } from 'express';
import { ok, ApiError } from '../utils/response.js';
import { listBookings, createBooking, destinationExists } from '../store/collections.js';
import { validateBooking } from '../middleware/validate.js';

const router = Router();

/**
 * GET /api/bookings（管理用途）
 */
router.get('/', (req, res) => {
  const limitRaw = Number.parseInt(req.query.limit ?? '50', 10);
  const offsetRaw = Number.parseInt(req.query.offset ?? '0', 10);
  const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(limitRaw, 1), 100);
  const offset = Number.isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0);
  res.json(ok(listBookings({ limit, offset })));
});

/**
 * POST /api/bookings
 * 提交预订意向；destinationId 必须存在，status 默认 pending。
 */
router.post('/', validateBooking, (req, res, next) => {
  const payload = req.validated;
  if (!destinationExists(payload.destinationId)) {
    return next(ApiError.notFound('目的地不存在'));
  }
  const created = createBooking(payload);
  return res.status(201).json(ok(created));
});

export default router;
