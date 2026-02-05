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
      res.status(400).json({ error: 'Invalid goal ID format' })
      return
    }

    if (req.method === 'PUT') {
      try {
        const data = req.body || {}
        
        const queryData = buildUpdateQuery(
          'goals',
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
          res.status(404).json({ error: 'Goal not found' })
          return
        }
        res.status(200).json({ goal: rows[0] })
      } catch (error) {
        console.error('Goals PUT error:', error)
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
        await query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [id, userId])
        res.status(200).json({ ok: true })
      } catch (error) {
        console.error('Goals DELETE error:', error)
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
      const { rows } = await query('SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC', [
        userId,
      ])
      res.status(200).json({ goals: rows })
    } catch (error) {
      console.error('Goals GET error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const data = req.body || {}
      
      // Validate required fields
      if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        res.status(400).json({ error: 'Goal name is required' })
        return
      }
      if (typeof data.target_amount !== 'number' || data.target_amount <= 0) {
        res.status(400).json({ error: 'Valid target amount is required' })
        return
      }
      
      const queryData = buildInsertQuery('goals', data, { user_id: userId })
      const { rows } = await query(queryData.text, queryData.values)
      res.status(201).json({ goal: rows[0] })
    } catch (error) {
      console.error('Goals POST error:', error)
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
