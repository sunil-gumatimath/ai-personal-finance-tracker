import { getAuthedUserId } from './_auth.js'
import { query } from './_db.js'
import { buildUpdateQuery, buildInsertQuery } from './_query-builder.js'
import type { ApiRequest, ApiResponse } from './_types.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Handle ID-based operations (PUT, DELETE)
  const id = req.query?.id
  if (id && typeof id === 'string') {
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      res.status(400).json({ error: 'Invalid transaction ID format' })
      return
    }

    if (req.method === 'PUT') {
      try {
        const data = req.body || {}
        
        const queryData = buildUpdateQuery(
          'transactions',
          data,
          'id = $1 AND user_id = $2',
          [id, userId]
        )
        
        if (!queryData) {
          res.status(400).json({ error: 'No valid fields to update' })
          return
        }
        
        const { rows } = await query(queryData.text, queryData.values)
        if (rows.length === 0) {
          res.status(404).json({ error: 'Transaction not found' })
          return
        }
        res.status(200).json({ transaction: rows[0] })
      } catch (error) {
        console.error('Transactions PUT error:', error)
        if (error instanceof Error && error.message.includes('Invalid columns')) {
          res.status(400).json({ error: error.message })
          return
        }
        res.status(500).json({ error: 'Server error' })
      }
      return
    }

    if (req.method === 'DELETE') {
      try {
        await query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id, userId])
        res.status(200).json({ ok: true })
      } catch (error) {
        console.error('Transactions DELETE error:', error)
        res.status(500).json({ error: 'Server error' })
      }
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Handle collection operations (GET, POST)
  if (req.method === 'GET') {
    try {
      const limit = req.query?.limit ? parseInt(req.query.limit, 10) : null
      const since = req.query?.since

      const whereParts = ['t.user_id = $1']
      const params: unknown[] = [userId]

      if (since && typeof since === 'string') {
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
          res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
          return
        }
        params.push(since)
        whereParts.push(`t.date >= $${params.length}`)
      }

      const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''
      // Validate limit is a reasonable number
      const safeLimit = limit && limit > 0 && limit <= 1000 ? limit : null
      const limitClause = safeLimit ? `LIMIT $${params.length + 1}` : ''
      if (safeLimit) params.push(safeLimit)

      const { rows } = await query(
        `
        SELECT
          t.*,
          row_to_json(c.*) as category,
          row_to_json(a.*) as account,
          row_to_json(ta.*) as to_account
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN accounts a ON t.account_id = a.id
        LEFT JOIN accounts ta ON t.to_account_id = ta.id
        ${whereClause}
        ORDER BY t.date DESC
        ${limitClause}
        `,
        params,
      )
      res.status(200).json({ transactions: rows })
    } catch (error) {
      console.error('Transactions GET error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const data = req.body || {}
      const txType = typeof data.type === 'string' ? data.type : ''
      const txAmount = typeof data.amount === 'number' ? data.amount : 0
      
      // Validate required fields
      if (!txType || !['income', 'expense', 'transfer'].includes(txType)) {
        res.status(400).json({ error: 'Valid transaction type is required (income, expense, transfer)' })
        return
      }
      if (txAmount <= 0) {
        res.status(400).json({ error: 'Valid amount is required' })
        return
      }
      
      const queryData = buildInsertQuery('transactions', data, { user_id: userId })
      const { rows } = await query(queryData.text, queryData.values)
      res.status(201).json({ transaction: rows[0] })
    } catch (error) {
      console.error('Transactions POST error:', error)
      if (error instanceof Error && error.message.includes('Invalid columns')) {
        res.status(400).json({ error: error.message })
        return
      }
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
