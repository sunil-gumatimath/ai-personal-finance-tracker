import { queryOne } from './_db.js'
import { verifyPassword, hashPassword } from './_crypto.js'
import { createToken, setAuthCookie, clearAuthCookie, getAuthedUser } from './_auth.js'
import type { ApiRequest, ApiResponse } from './_types.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const action = req.query?.action

    // Handle /api/auth?action=me
    if (action === 'me') {
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
        return
    }

    // Handle /api/auth?action=logout
    if (action === 'logout') {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' })
            return
        }

        clearAuthCookie(res)
        res.status(200).json({ ok: true })
        return
    }

    // Handle /api/auth?action=signup
    if (action === 'signup') {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' })
            return
        }

        try {
            const body = req.body || {}
            const email = typeof body.email === 'string' ? body.email : ''
            const password = typeof body.password === 'string' ? body.password : ''
            const fullName = typeof body.fullName === 'string' ? body.fullName : ''
            
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
        return
    }

    // Handle /api/auth?action=login (default POST action)
    if (action === 'login' || req.method === 'POST') {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' })
            return
        }

        try {
            const body = req.body || {}
            const email = typeof body.email === 'string' ? body.email : ''
            const password = typeof body.password === 'string' ? body.password : ''
            
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
        return
    }

    res.status(405).json({ error: 'Method not allowed' })
}
