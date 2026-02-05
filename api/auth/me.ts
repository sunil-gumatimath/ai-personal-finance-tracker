import { getAuthedUser } from '../_auth'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const user = await getAuthedUser(req)
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.full_name, avatar_url: user.avatar_url },
        app_metadata: {},
        aud: 'authenticated',
        created_at: user.created_at,
      },
    })
  } catch (error) {
    console.error('Auth me error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}
