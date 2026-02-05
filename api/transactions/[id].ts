import { getAuthedUserId } from '../_auth'
import { query } from '../_db'

export default async function handler(req: any, res: any) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const id = req.query?.id
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Missing id' })
    return
  }

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
}
