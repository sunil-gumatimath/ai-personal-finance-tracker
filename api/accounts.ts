import { getAuthedUserId } from './_auth.js'
import { query, queryOne } from './_db.js'
import type { ApiRequest, ApiResponse } from './_types.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Handle linked-count action
  const action = req.query?.action
  if (action === 'linked-count') {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const accountId = req.query?.accountId
    if (!accountId || typeof accountId !== 'string') {
      res.status(400).json({ error: 'Missing accountId' })
      return
    }
    try {
      const row = await queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM transactions WHERE (account_id = $1 OR to_account_id = $1) AND user_id = $2',
        [accountId, userId],
      )
      res.status(200).json({ count: parseInt(row?.count || '0', 10) })
    } catch (error) {
      console.error('Accounts linked-count error:', error)
      res.status(500).json({ error: 'Server error' })
    }
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
        const text = `UPDATE accounts SET ${setClause} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2} RETURNING *`
        const { rows } = await query(text, values)
        res.status(200).json({ account: rows[0] })
      } catch (error) {
        console.error('Accounts PUT error:', error)
        res.status(500).json({ error: 'Server error' })
      }
      return
    }

    if (req.method === 'DELETE') {
      try {
        const cascade = req.query?.cascade === '1'
        if (cascade) {
          await query('DELETE FROM transactions WHERE account_id = $1 OR to_account_id = $1', [id])
        }
        await query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [id, userId])
        res.status(200).json({ ok: true })
      } catch (error) {
        console.error('Accounts DELETE error:', error)
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
        'SELECT * FROM accounts WHERE user_id = $1 ORDER BY is_active DESC, name ASC',
        [userId],
      )
      res.status(200).json({ accounts: rows })
    } catch (error) {
      console.error('Accounts GET error:', error)
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
      const text = `INSERT INTO accounts (${columns}) VALUES (${placeholders}) RETURNING *`
      const { rows } = await query(text, values)
      res.status(201).json({ account: rows[0] })
    } catch (error) {
      console.error('Accounts POST error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
