import { getAuthedUserId } from './_auth.js'
import { queryOne } from './_db.js'
import { buildUpdateQuery } from './_query-builder.js'
import type { ApiRequest, ApiResponse } from './_types.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
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
      const body = req.body || {}
      const preferences = body.preferences as Record<string, unknown> | undefined
      const currency = typeof body.currency === 'string' ? body.currency : undefined
      const full_name = body.full_name
      const avatar_url = body.avatar_url

      // Validate currency if provided
      if (currency !== undefined) {
        const validCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CNY']
        if (!validCurrencies.includes(currency)) {
          res.status(400).json({ error: 'Invalid currency code' })
          return
        }
      }

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
        const updateData: Record<string, unknown> = {}
        if (full_name !== undefined) {
          if (typeof full_name !== 'string') {
            res.status(400).json({ error: 'Full name must be a string' })
            return
          }
          updateData.full_name = full_name
        }
        if (avatar_url !== undefined) {
          if (avatar_url !== null && typeof avatar_url !== 'string') {
            res.status(400).json({ error: 'Avatar URL must be a string or null' })
            return
          }
          updateData.avatar_url = avatar_url
        }

        // Use safe query builder to prevent SQL injection
        const usersQuery = buildUpdateQuery('users', updateData, 'id = $1', [userId])
        const profilesQuery = buildUpdateQuery('profiles', updateData, 'user_id = $1', [userId])

        if (usersQuery) await queryOne(usersQuery.text, usersQuery.values)
        if (profilesQuery) await queryOne(profilesQuery.text, profilesQuery.values)
      }

      res.status(200).json({ ok: true, preferences: merged, currency: currency || null })
    } catch (error) {
      console.error('Profile PATCH error:', error)
      // Sanitize error messages to avoid leaking internal details
      if (error instanceof Error && (error.message.includes('Invalid') || error.message.includes('exceeds maximum length'))) {
        res.status(400).json({ error: 'Invalid request' })
        return
      }
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
