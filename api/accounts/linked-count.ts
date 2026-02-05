import { getAuthedUserId } from '../_auth'
import { queryOne } from '../_db'

export default async function handler(req: any, res: any) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

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
}
