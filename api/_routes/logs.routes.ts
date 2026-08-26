import { getAuthedUserId } from "../_services/auth.service.js"
import { query } from "../_repositories/db.js"
import { ValidationError } from "../_errors/AppError.js"
import { sendApiError } from "../_utils/respond.js"
import type { ApiRequest, ApiResponse } from "../_utils/types"

const VALID_SEVERITIES = new Set(["info", "warning", "error", "critical"])
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500

/**
 * GET /api/system-logs — the user's audit trail across ALL logged event
 * types (transactions, accounts, auth events, recurring runs, errors).
 *
 * Optional query params:
 *   severity  – info | warning | error | critical
 *   action    – exact action name (e.g. USER_LOGIN)
 *   days      – only entries from the last N days (1–365)
 *   limit     – 1..500 (default 200)
 *
 * Responds { logs, total } where `total` is the full matched count for the
 * user's scope BEFORE the limit is applied, so clients can show truthful
 * aggregate counts even when the window is truncated.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const conditions = ['user_id = $1']
    const values: unknown[] = [userId]

    const severity = req.query?.severity
    if (severity && typeof severity === 'string') {
      if (!VALID_SEVERITIES.has(severity)) {
        throw new ValidationError('Invalid severity filter')
      }
      values.push(severity)
      conditions.push(`severity = $${values.length}`)
    }

    const action = req.query?.action
    if (action && typeof action === 'string') {
      if (!/^[A-Z_]{2,64}$/.test(action)) {
        throw new ValidationError('Invalid action filter')
      }
      values.push(action)
      conditions.push(`action = $${values.length}`)
    }

    const daysRaw = req.query?.days
    if (daysRaw !== undefined && daysRaw !== '') {
      const days = Number(daysRaw)
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        throw new ValidationError('days must be an integer between 1 and 365')
      }
      values.push(days)
      conditions.push(
        `timestamp >= now() - ($${values.length}::text || ' days')::interval`,
      )
    }

    let limit = DEFAULT_LIMIT
    const limitRaw = req.query?.limit
    if (limitRaw !== undefined && limitRaw !== '') {
      const parsed = Number(limitRaw)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
        throw new ValidationError(`limit must be an integer between 1 and ${MAX_LIMIT}`)
      }
      limit = parsed
    }
    values.push(limit)

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    const countResult = await query<{ total: number | string }>(
      `SELECT COUNT(*)::bigint AS total FROM system_logs ${whereClause}`,
      values.slice(0, -1),
    )
    const total = Number(countResult.rows[0]?.total ?? 0)

    const { rows } = await query(
      `SELECT 
          id, 
          timestamp, 
          action, 
          resource, 
          old_value AS "oldValue", 
          new_value AS "newValue", 
          user_id AS "userId", 
          user_email AS "userEmail", 
          severity, 
          status, 
          metadata 
        FROM system_logs 
        ${whereClause}
        ORDER BY timestamp DESC 
        LIMIT $${values.length}`,
      values,
    )
    res.status(200).json({ logs: rows, total })
  } catch (error) {
    console.error('system-logs GET error:', error)
    sendApiError(res, error)
  }
}
