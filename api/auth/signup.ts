import { queryOne } from '../_db'
import { hashPassword } from '../_crypto'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { email, password, fullName } = req.body || {}
    if (!email || !password || !fullName) {
      res.status(400).json({ error: 'Email, password, and full name are required' })
      return
    }

    const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = $1', [
      email,
    ])
    if (existing) {
      res.status(409).json({ error: 'User already exists' })
      return
    }

    const hashedPassword = await hashPassword(password)
    const newUser = await queryOne<{
      id: string
      email: string
      full_name: string
      avatar_url: string | null
      created_at: string
    }>(
      'INSERT INTO users (email, encrypted_password, full_name) VALUES ($1, $2, $3) RETURNING *',
      [email, hashedPassword, fullName],
    )

    if (!newUser) {
      res.status(500).json({ error: 'Failed to create user' })
      return
    }

    await queryOne(
      'INSERT INTO profiles (user_id, full_name, currency) VALUES ($1, $2, $3) RETURNING user_id',
      [newUser.id, fullName, 'USD'],
    )

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        user_metadata: { full_name: newUser.full_name, avatar_url: newUser.avatar_url },
        app_metadata: {},
        aud: 'authenticated',
        created_at: newUser.created_at,
      },
    })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}
