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

  const action = req.query?.action

  // Handle debt payments
  if (action === 'payments') {
    if (req.method === 'GET') {
      try {
        const debtId = req.query?.debtId
        if (!debtId || typeof debtId !== 'string') {
          res.status(400).json({ error: 'Missing debtId' })
          return
        }
        // Validate UUID format
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(debtId)) {
          res.status(400).json({ error: 'Invalid debt ID format' })
          return
        }
        const { rows } = await query(
          `
          SELECT * FROM debt_payments
          WHERE debt_id = $1 AND user_id = $2
          ORDER BY payment_date DESC
          LIMIT 10
          `,
          [debtId, userId],
        )
        res.status(200).json({ payments: rows })
      } catch (error) {
        console.error('Debt payments GET error:', error)
        res.status(500).json({ error: 'Server error' })
      }
      return
    }

    if (req.method === 'POST') {
      try {
        const data = req.body || {}
        
        // Validate required fields
        if (!data.debt_id || typeof data.debt_id !== 'string') {
          res.status(400).json({ error: 'Debt ID is required' })
          return
        }
        if (typeof data.amount !== 'number' || data.amount <= 0) {
          res.status(400).json({ error: 'Valid payment amount is required' })
          return
        }
        
        const queryData = buildInsertQuery('debt_payments', data, { user_id: userId })
        const { rows } = await query(queryData.text, queryData.values)
        res.status(201).json({ payment: rows[0] })
      } catch (error) {
        console.error('Debt payments POST error:', error)
        if (error instanceof Error && error.message.includes('Invalid columns')) {
          res.status(400).json({ error: error.message })
          return
        }
        res.status(500).json({ error: 'Server error' })
      }
      return
    }
  }

  // Handle ID-based operations (PUT, DELETE)
  const id = req.query?.id
  if (id && typeof id === 'string') {
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      res.status(400).json({ error: 'Invalid debt ID format' })
      return
    }

    if (req.method === 'PUT') {
      try {
        const data = req.body || {}
        
        const queryData = buildUpdateQuery(
          'debts',
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
          res.status(404).json({ error: 'Debt not found' })
          return
        }
        res.status(200).json({ debt: rows[0] })
      } catch (error) {
        console.error('Debts PUT error:', error)
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
        await query('DELETE FROM debts WHERE id = $1 AND user_id = $2', [id, userId])
        res.status(200).json({ ok: true })
      } catch (error) {
        console.error('Debts DELETE error:', error)
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
      const { rows } = await query(
        'SELECT * FROM debts WHERE user_id = $1 ORDER BY is_active DESC, current_balance DESC',
        [userId],
      )
      res.status(200).json({ debts: rows })
    } catch (error) {
      console.error('Debts GET error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const data = req.body || {}
      
      // Validate required fields
      if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        res.status(400).json({ error: 'Debt name is required' })
        return
      }
      if (typeof data.original_amount !== 'number' || data.original_amount <= 0) {
        res.status(400).json({ error: 'Valid original amount is required' })
        return
      }
      
      const queryData = buildInsertQuery('debts', data, { user_id: userId })
      const { rows } = await query(queryData.text, queryData.values)
      res.status(201).json({ debt: rows[0] })
    } catch (error) {
      console.error('Debts POST error:', error)
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
