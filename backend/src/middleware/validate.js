import { ApiError } from '../utils/response.js';

/**
 * 轻量入参校验（零第三方依赖）。
 * 校验通过时把净化后的数据挂到 req.validated，失败抛出 ApiError(400, VALIDATION_ERROR)。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 是否为非空字符串且在长度范围内 */
function isStr(value, min = 1, max = Infinity) {
  return (
    typeof value === 'string' &&
    value.trim().length >= min &&
    value.trim().length <= max
  );
}

/** 是否为整数且在范围内 */
function isInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** 是否为 0–5 的数值（可含一位小数） */
function isRating(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 5;
}

/** 校验数组且元素均为非空字符串 */
function isStrArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * POST /api/destinations 校验。
 */
export function validateDestination(req, _res, next) {
  const b = req.body ?? {};
  if (!isStr(b.name, 1, 60)) return next(ApiError.badRequest('name 必填，长度 1–60'));
  if (!isStr(b.city, 1, 60)) return next(ApiError.badRequest('city 必填，长度 1–60'));
  if (!isStr(b.country, 1, 60)) return next(ApiError.badRequest('country 必填，长度 1–60'));
  if (!isStr(b.summary, 1, 200)) return next(ApiError.badRequest('summary 必填，长度 1–200'));
  if (b.rating !== undefined && b.rating !== null && !isRating(b.rating)) {
    return next(ApiError.badRequest('rating 需为 0–5 的数值'));
  }
  if (b.tags !== undefined && !isStrArray(b.tags)) {
    return next(ApiError.badRequest('tags 需为字符串数组'));
  }
  if (b.region !== undefined && typeof b.region !== 'string') {
    return next(ApiError.badRequest('region 需为字符串'));
  }
  if (b.reviewCount !== undefined && !isInt(b.reviewCount, 0, Number.MAX_SAFE_INTEGER)) {
    return next(ApiError.badRequest('reviewCount 需为非负整数'));
  }
  if (b.featured !== undefined && typeof b.featured !== 'boolean') {
    return next(ApiError.badRequest('featured 需为布尔值'));
  }

  req.validated = {
    name: b.name.trim(),
    city: b.city.trim(),
    country: b.country.trim(),
    region: typeof b.region === 'string' ? b.region.trim() : '',
    tags: b.tags ?? [],
    summary: b.summary.trim(),
    description: typeof b.description === 'string' ? b.description : '',
    image: typeof b.image === 'string' ? b.image : '',
    gallery: isStrArray(b.gallery) ? b.gallery : [],
    rating: b.rating ?? 0,
    reviewCount: b.reviewCount ?? 0,
    bestSeason: typeof b.bestSeason === 'string' ? b.bestSeason : '',
    highlights: isStrArray(b.highlights) ? b.highlights : [],
    coordinates:
      b.coordinates && typeof b.coordinates === 'object'
        ? {
            lat: Number(b.coordinates.lat),
            lng: Number(b.coordinates.lng),
          }
        : null,
    featured: b.featured ?? false,
  };
  return next();
}

/**
 * POST /api/messages 校验。
 */
export function validateMessage(req, _res, next) {
  const b = req.body ?? {};
  if (!isStr(b.destinationId, 1, 100)) {
    return next(ApiError.badRequest('destinationId 必填'));
  }
  if (!isStr(b.author, 1, 30)) return next(ApiError.badRequest('author 长度需为 1–30'));
  if (!isStr(b.content, 1, 500)) return next(ApiError.badRequest('content 长度需为 1–500'));
  if (b.email !== undefined && b.email !== '' && !EMAIL_RE.test(String(b.email))) {
    return next(ApiError.badRequest('email 格式不正确'));
  }
  if (b.rating !== undefined && b.rating !== null && !isInt(b.rating, 1, 5)) {
    return next(ApiError.badRequest('rating 需为 1–5 的整数'));
  }

  const validated = {
    destinationId: b.destinationId.trim(),
    author: b.author.trim(),
    content: b.content.trim(),
  };
  if (b.email) validated.email = String(b.email).trim();
  if (b.rating !== undefined && b.rating !== null) validated.rating = b.rating;
  req.validated = validated;
  return next();
}

/**
 * POST /api/bookings 校验。
 */
export function validateBooking(req, _res, next) {
  const b = req.body ?? {};
  if (!isStr(b.destinationId, 1, 100)) {
    return next(ApiError.badRequest('destinationId 必填'));
  }
  if (!isStr(b.name, 1, 30)) return next(ApiError.badRequest('name 长度需为 1–30'));
  if (!b.email || !EMAIL_RE.test(String(b.email))) {
    return next(ApiError.badRequest('email 格式不正确'));
  }
  if (!b.travelDate || !DATE_RE.test(String(b.travelDate))) {
    return next(ApiError.badRequest('travelDate 需匹配 YYYY-MM-DD'));
  }
  if (!isInt(b.guests, 1, 20)) {
    return next(ApiError.badRequest('guests 需为 1–20 的整数'));
  }
  if (b.phone !== undefined && b.phone !== '' && !isStr(b.phone, 5, 20)) {
    return next(ApiError.badRequest('phone 长度需为 5–20'));
  }
  if (b.notes !== undefined && b.notes !== '' && !isStr(b.notes, 1, 300)) {
    return next(ApiError.badRequest('notes 长度需为 1–300'));
  }

  const validated = {
    destinationId: b.destinationId.trim(),
    name: b.name.trim(),
    email: String(b.email).trim(),
    travelDate: String(b.travelDate),
    guests: b.guests,
  };
  if (b.phone) validated.phone = String(b.phone).trim();
  if (b.notes) validated.notes = String(b.notes).trim();
  req.validated = validated;
  return next();
}

export default { validateDestination, validateMessage, validateBooking };
