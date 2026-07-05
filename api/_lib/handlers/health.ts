import type { ApiRequest, ApiResponse } from '../utils/types.js'

/**
 * GET /api/health
 * Lightweight liveness probe for uptime monitoring and deploy checks.
 * Does not touch the database or auth — intentionally cheap.
 */
export default async function handler(_req: ApiRequest, res: ApiResponse) {
  return res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  })
}
