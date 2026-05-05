import { authClient } from './_auth.js'
import { queryOne } from './_db.js'
import { checkRateLimit, recordFailedAttempt } from './_rate-limiter.js'
import type { ApiRequest, ApiResponse } from './_types.js'

function getClientId(req: ApiRequest): string {
  return req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || 'unknown'
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const action = req.query?.action

    // Handle /api/auth?action=me
    if (action === 'me') {
        if (req.method !== 'GET') {
            res.status(405).json({ error: 'Method not allowed' })
            return
        }

        try {
            const incomingHeaders = new Headers()
            if (req.headers?.cookie) incomingHeaders.set('cookie', Array.isArray(req.headers.cookie) ? req.headers.cookie.join(';') : req.headers.cookie)
            if (req.headers?.authorization) incomingHeaders.set('authorization', Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization)

            const session = await authClient.getSession({
                headers: incomingHeaders
            })

            if (!session) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }

            const { user } = session
            res.status(200).json({
                user: {
                    id: user.id,
                    email: user.email,
                    user_metadata: { full_name: user.name, avatar_url: user.image },
                    app_metadata: {},
                    aud: 'authenticated',
                    created_at: user.createdAt,
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

        res.status(200).json({ ok: true })
        return
    }

    // Handle /api/auth?action=sync
    if (action === 'sync') {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' })
            return
        }

        try {
            const incomingHeaders = new Headers()
            if (req.headers?.cookie) incomingHeaders.set('cookie', Array.isArray(req.headers.cookie) ? req.headers.cookie.join(';') : req.headers.cookie)
            if (req.headers?.authorization) incomingHeaders.set('authorization', Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization)

            const session = await authClient.getSession({
                headers: incomingHeaders
            })

            if (!session) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }

            const { user } = session
            const body = req.body || {}
            const fullName = body.fullName || user.name || 'Unknown'

            // Ensure user exists in our users table
            await queryOne(
                'INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
                [user.id, user.email, fullName]
            )

            // Ensure profile exists in our database
            await queryOne(
                'INSERT INTO profiles (user_id, full_name, currency) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING',
                [user.id, fullName, 'USD'],
            )

            res.status(200).json({ ok: true })
        } catch (error) {
            console.error('Sync error:', error)
            res.status(500).json({ error: 'Server error' })
        }
        return
    }

    // Handle /api/auth?action=signup
    if (action === 'signup') {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' })
            return
        }

        const clientId = getClientId(req)
        const rateCheck = checkRateLimit(clientId, 'signup', true)
        if (!rateCheck.allowed) {
            res.status(429).json({ error: 'Too many signup attempts. Please try again later.' })
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

            const { data, error } = await authClient.signUp.email({
                email,
                password,
                name: fullName,
            })

            if (error) {
                console.error('Neon Auth signup error:', error)
                res.status(400).json({ error: error.message || 'Signup failed' })
                return
            }

            if (data?.user) {
                // Ensure user exists in our users table (required for foreign key in profiles)
                await queryOne(
                    'INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
                    [data.user.id, email, fullName]
                )

                // Ensure profile exists in our database
                await queryOne(
                    'INSERT INTO profiles (user_id, full_name, currency) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING RETURNING user_id',
                    [data.user.id, fullName, 'USD'],
                )

                res.status(201).json({
                    user: {
                        id: data.user.id,
                        email: data.user.email,
                        user_metadata: { full_name: data.user.name, avatar_url: data.user.image },
                        app_metadata: {},
                        aud: 'authenticated',
                        created_at: data.user.createdAt,
                    },
                })
            } else {
                res.status(500).json({ error: 'Failed to create user' })
            }
        } catch (error) {
            console.error('Signup error:', error)
            res.status(500).json({ error: 'Server error' })
        }
        return
    }

    // Handle /api/auth?action=login
    if (action === 'login' || req.method === 'POST') {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' })
            return
        }

        const clientId = getClientId(req)
        const rateCheck = checkRateLimit(clientId, 'login', true)
        if (!rateCheck.allowed) {
            res.status(429).json({ error: 'Too many login attempts. Please try again later.' })
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

            const { data, error } = await authClient.signIn.email({
                email,
                password,
            })

            if (error) {
                recordFailedAttempt(clientId, 'login')
                res.status(401).json({ error: 'Invalid email or password' })
                return
            }

            if (data?.user) {
                res.status(200).json({
                    user: {
                        id: data.user.id,
                        email: data.user.email,
                        user_metadata: { full_name: data.user.name, avatar_url: data.user.image },
                        app_metadata: {},
                        aud: 'authenticated',
                        created_at: data.user.createdAt,
                    },
                })
            } else {
                res.status(401).json({ error: 'Invalid email or password' })
            }
        } catch (error) {
            console.error('Login error:', error)
            res.status(500).json({ error: 'Server error' })
        }
        return
    }

    res.status(405).json({ error: 'Method not allowed' })
}
