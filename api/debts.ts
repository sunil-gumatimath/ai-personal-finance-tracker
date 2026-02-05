import { getAuthedUserId } from './_auth.js'
import { query } from './_db.js'
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
        const keys = Object.keys(data).filter(k => k !== 'user_id')
        const values = keys.map(k => data[k])
        keys.push('user_id')
        values.push(userId)
        const columns = keys.join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
        const text = `INSERT INTO debt_payments (${columns}) VALUES (${placeholders}) RETURNING *`
        const { rows } = await query(text, values)
        res.status(201).json({ payment: rows[0] })
      } catch (error) {
        console.error('Debt payments POST error:', error)
        res.status(500).json({ error: 'Server error' })
      }
      return
    }
  }

  // Handle ID-based operations (PUT, DELETE)
  const id = req.query?.id
  if (id && typeof id === 'string') {
    if (req.method === 'PUT') {
      try {
        const data = req.body || {}
        const keys = Object.keys(data).filter(k => k !== 'user_id')
        const values = keys.map(k => data[k])
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
        values.push(id, userId)
        const text = `UPDATE debts SET ${setClause} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2} RETURNING *`
        const { rows } = await query(text, values)
        res.status(200).json({ debt: rows[0] })
      } catch (error) {
        console.error('Debts PUT error:', error)
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
      const keys = Object.keys(data).filter(k => k !== 'user_id')
      const values = keys.map(k => data[k])
      keys.push('user_id')
      values.push(userId)
      const columns = keys.join(', ')
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
      const text = `INSERT INTO debts (${columns}) VALUES (${placeholders}) RETURNING *`
      const { rows } = await query(text, values)
      res.status(201).json({ debt: rows[0] })
    } catch (error) {
      console.error('Debts POST error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
