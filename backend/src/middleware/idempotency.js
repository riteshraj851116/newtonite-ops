import crypto from 'crypto';
import { prisma } from '../config/db.js';

export const requireIdempotency = async (req, res, next) => {
  const idempotencyKey =
    req.headers['idempotency-key'] ||
    req.headers['x-idempotency-key'] ||
    req.body?.idempotencyKey;

  if (!idempotencyKey) {
    return next();
  }

  if (!req.user) {
    return next();
  }

  const endpoint = `${req.method} ${req.baseUrl}${req.path}`;
  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(req.body || {}))
    .digest('hex');

  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key: String(idempotencyKey) },
    });

    if (existing) {
      // Check expiration (24h)
      if (new Date() > new Date(existing.expiresAt)) {
        await prisma.idempotencyKey.delete({ where: { id: existing.id } });
      } else {
        if (existing.status === 'IN_PROGRESS') {
          return res.status(409).json({
            success: false,
            message:
              'A request with this Idempotency-Key is currently in progress. Please retry momentarily.',
            conflictType: 'IDEMPOTENCY_CONCURRENT',
          });
        }

        if (existing.status === 'COMPLETED') {
          res.setHeader('X-Idempotent-Replay', 'true');
          return res.status(existing.statusCode || 200).json(existing.responseBody);
        }
      }
    }

    // Insert in-progress record
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    let record;
    try {
      record = await prisma.idempotencyKey.create({
        data: {
          key: String(idempotencyKey),
          userId: req.user.id,
          endpoint,
          requestHash,
          status: 'IN_PROGRESS',
          expiresAt,
        },
      });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message:
            'Concurrent request with the same Idempotency-Key detected. Please wait for completion.',
          conflictType: 'IDEMPOTENCY_RACE',
        });
      }
      throw err;
    }

    // Intercept response write and wait for DB commit so immediate repeat requests see COMPLETED
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.json = originalJson;

      prisma.idempotencyKey
        .update({
          where: { id: record.id },
          data: {
            status: res.statusCode < 400 ? 'COMPLETED' : 'FAILED',
            statusCode: res.statusCode,
            responseBody: body,
          },
        })
        .catch((e) => console.error('[Idempotency Record Error]', e.message))
        .finally(() => {
          originalJson(body);
        });

      return res;
    };

    next();
  } catch (error) {
    next(error);
  }
};
