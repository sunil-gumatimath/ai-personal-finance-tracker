import type { ApiRequest, ApiResponse } from '../_utils/types.js'

/**
 * GET /api/health
 * Lightweight liveness probe for uptime monitoring and deploy checks.
 * Does not touch the database or auth — intentionally cheap. Exposes no
 * runtime details (no uptime, no NODE_ENV).
 */
export default async function handler(_req: ApiRequest, res: ApiResponse) {
  return res.status(200).json({ status: 'ok' })
}
