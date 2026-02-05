import { getAuthedUserId } from './_auth'
import { query } from './_db'

export default async function handler(req: any, res: any) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
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
        const text = `UPDATE transactions SET ${setClause} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2} RETURNING *`
        const { rows } = await query(text, values)
        res.status(200).json({ transaction: rows[0] })
      } catch (error) {
        console.error('Transactions PUT error:', error)
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
        params.push(since)
        whereParts.push(`t.date >= $${params.length}`)
      }

      const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''
      const limitClause = limit ? `LIMIT ${limit}` : ''

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
      const keys = Object.keys(data).filter(k => k !== 'user_id')
      const values = keys.map(k => data[k])
      keys.push('user_id')
      values.push(userId)
      const columns = keys.join(', ')
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
      const text = `INSERT INTO transactions (${columns}) VALUES (${placeholders}) RETURNING *`
      const { rows } = await query(text, values)
      res.status(201).json({ transaction: rows[0] })
    } catch (error) {
      console.error('Transactions POST error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
