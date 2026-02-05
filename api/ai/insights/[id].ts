import { getAuthedUserId } from '../../_auth'
import { query } from '../../_db'

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

  if (req.method === 'PATCH') {
    try {
      await query('UPDATE ai_insights SET is_dismissed = true WHERE id = $1 AND user_id = $2', [
        id,
        userId,
      ])
      res.status(200).json({ ok: true })
    } catch (error) {
      console.error('AI insight PATCH error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
