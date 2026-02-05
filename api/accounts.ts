import { getAuthedUserId } from './_auth.js'
import { query, queryOne } from './_db.js'
import { buildUpdateQuery, buildInsertQuery } from './_query-builder.js'
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
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)) {
      res.status(400).json({ error: 'Invalid account ID format' })
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
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      res.status(400).json({ error: 'Invalid account ID format' })
      return
    }

    if (req.method === 'PUT') {
      try {
        const data = req.body || {}
        
        const queryData = buildUpdateQuery(
          'accounts',
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
          res.status(404).json({ error: 'Account not found' })
          return
        }
        res.status(200).json({ account: rows[0] })
      } catch (error) {
        console.error('Accounts PUT error:', error)
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
      
      // Validate required fields
      if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        res.status(400).json({ error: 'Account name is required' })
        return
      }
      if (!data.type || typeof data.type !== 'string') {
        res.status(400).json({ error: 'Account type is required' })
        return
      }
      
      const queryData = buildInsertQuery('accounts', data, { user_id: userId })
      const { rows } = await query(queryData.text, queryData.values)
      res.status(201).json({ account: rows[0] })
    } catch (error) {
      console.error('Accounts POST error:', error)
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
