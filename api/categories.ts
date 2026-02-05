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
        const text = `UPDATE categories SET ${setClause} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2} RETURNING *`
        const { rows } = await query(text, values)
        res.status(200).json({ category: rows[0] })
      } catch (error) {
        console.error('Categories PUT error:', error)
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
      const keys = Object.keys(data).filter(k => k !== 'user_id')
      const values = keys.map(k => data[k])
      keys.push('user_id')
      values.push(userId)
      const columns = keys.join(', ')
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
      const text = `INSERT INTO categories (${columns}) VALUES (${placeholders}) RETURNING *`
      const { rows } = await query(text, values)
      res.status(201).json({ category: rows[0] })
    } catch (error) {
      console.error('Categories POST error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
