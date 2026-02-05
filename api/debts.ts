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
