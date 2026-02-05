import { getAuthedUserId } from './_auth'
import { query } from './_db'

export default async function handler(req: any, res: any) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

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
