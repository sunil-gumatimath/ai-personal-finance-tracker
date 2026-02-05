import { getAuthedUserId } from './_auth'
import { queryOne } from './_db'

export default async function handler(req: any, res: any) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (req.method === 'GET') {
    try {
      const row = await queryOne<{ preferences: Record<string, unknown> | null; currency: string | null }>(
        'SELECT preferences, currency FROM profiles WHERE user_id = $1',
        [userId],
      )
      res.status(200).json({
        preferences: row?.preferences || {},
        currency: row?.currency || null,
      })
    } catch (error) {
      console.error('Profile GET error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  if (req.method === 'PATCH') {
    try {
      const { preferences, currency, full_name, avatar_url } = req.body || {}
      const existing = await queryOne<{ preferences: Record<string, unknown> | null }>(
        'SELECT preferences FROM profiles WHERE user_id = $1',
        [userId],
      )

      const merged = {
        ...(existing?.preferences || {}),
        ...(preferences || {}),
      }

      await queryOne(
        'UPDATE profiles SET preferences = $1, currency = COALESCE($2, currency), updated_at = NOW() WHERE user_id = $3 RETURNING user_id',
        [JSON.stringify(merged), currency || null, userId],
      )

      if (full_name !== undefined || avatar_url !== undefined) {
        const updates: string[] = []
        const values: (string | null)[] = []
        let i = 1
        if (full_name !== undefined) {
          updates.push(`full_name = $${i++}`)
          values.push(full_name)
        }
        if (avatar_url !== undefined) {
          updates.push(`avatar_url = $${i++}`)
          values.push(avatar_url)
        }
        values.push(userId)
        await queryOne(`UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id`, values)
        await queryOne(
          `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $${i} RETURNING user_id`,
          values,
        )
      }

      res.status(200).json({ ok: true, preferences: merged, currency: currency || null })
    } catch (error) {
      console.error('Profile PATCH error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
