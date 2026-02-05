import { queryOne } from '../_db'
import { verifyPassword, hashPassword } from '../_crypto'
import { createToken, setAuthCookie } from '../_auth'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const user = await queryOne<{
      id: string
      email: string
      encrypted_password?: string
      full_name: string
      avatar_url: string | null
      created_at: string
    }>('SELECT * FROM users WHERE email = $1', [email])

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const storedPassword = user.encrypted_password || ''
    let isValid = false
    let isLegacy = false

    if (storedPassword.startsWith('$pbkdf2$')) {
      isValid = await verifyPassword(password, storedPassword)
    } else if (storedPassword === password) {
      isValid = true
      isLegacy = true
    }

    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    if (isLegacy) {
      const newHash = await hashPassword(password)
      await queryOne('UPDATE users SET encrypted_password = $1 WHERE id = $2 RETURNING id', [
        newHash,
        user.id,
      ])
    }

    await queryOne('UPDATE users SET last_sign_in_at = NOW() WHERE id = $1 RETURNING id', [
      user.id,
    ])

    const token = createToken({ sub: user.id, email: user.email })
    setAuthCookie(res, token)

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
    console.error('Login error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}
