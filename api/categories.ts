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
      res.status(400).json({ error: 'Invalid category ID format' })
      return
    }

    if (req.method === 'PUT') {
      try {
        const data = req.body || {}
        
        const queryData = buildUpdateQuery(
          'categories',
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
          res.status(404).json({ error: 'Category not found' })
          return
        }
        res.status(200).json({ category: rows[0] })
      } catch (error) {
        console.error('Categories PUT error:', error)
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
        await query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, userId])
        res.status(200).json({ ok: true })
      } catch (error) {
        console.error('Categories DELETE error:', error)
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
      const type = req.query?.type
      if (type) {
        // Validate type parameter
        if (!['income', 'expense'].includes(type)) {
          res.status(400).json({ error: 'Invalid category type' })
          return
        }
        const { rows } = await query('SELECT * FROM categories WHERE user_id = $1 AND type = $2', [
          userId,
          type,
        ])
        res.status(200).json({ categories: rows })
      } else {
        const { rows } = await query('SELECT * FROM categories WHERE user_id = $1', [userId])
        res.status(200).json({ categories: rows })
      }
    } catch (error) {
      console.error('Categories GET error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const data = req.body || {}
      const catName = typeof data.name === 'string' ? data.name : ''
      const catType = typeof data.type === 'string' ? data.type : ''
      
      // Validate required fields
      if (!catName || catName.trim().length === 0) {
        res.status(400).json({ error: 'Category name is required' })
        return
      }
      if (!catType || !['income', 'expense'].includes(catType)) {
        res.status(400).json({ error: 'Valid category type is required (income, expense)' })
        return
      }
      
      const queryData = buildInsertQuery('categories', data, { user_id: userId })
      const { rows } = await query(queryData.text, queryData.values)
      res.status(201).json({ category: rows[0] })
    } catch (error) {
      console.error('Categories POST error:', error)
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
