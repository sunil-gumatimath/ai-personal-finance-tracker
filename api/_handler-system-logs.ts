import { getAuthedUserId } from './_auth.js'
import { query } from './_db.js'
import { ensureSystemLogsTable } from './_logger.js'
import type { ApiRequest, ApiResponse } from './_types.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (req.method === 'GET') {
    try {
      await ensureSystemLogsTable()
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
        WHERE action IN ('TRANSACTION_CREATED', 'TRANSACTION_EDITED', 'TRANSACTION_DELETED')
        ORDER BY timestamp DESC 
        LIMIT 200`
      )
      res.status(200).json({ logs: rows })
    } catch (error) {
      console.error('system-logs GET error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
