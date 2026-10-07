import { Router } from 'express';
import { ok, ApiError } from '../utils/response.js';
import {
  createMessage,
  deleteMessage,
  destinationExists,
  toPublicMessage,
} from '../store/collections.js';
import { validateMessage } from '../middleware/validate.js';

const router = Router();

/**
 * POST /api/messages
 * 提交留言；destinationId 必须存在，否则 404。
 */
router.post('/', validateMessage, (req, res, next) => {
  const payload = req.validated;
  if (!destinationExists(payload.destinationId)) {
    return next(ApiError.notFound('目的地不存在'));
  }
  const created = createMessage(payload);
  return res.status(201).json(ok(toPublicMessage(created)));
});

/**
 * DELETE /api/messages/:id
 */
router.delete('/:id', (req, res, next) => {
  const removed = deleteMessage(req.params.id);
  if (!removed) {
    return next(ApiError.notFound('留言不存在'));
  }
  return res.json(ok({ id: req.params.id }));
});

export default router;
