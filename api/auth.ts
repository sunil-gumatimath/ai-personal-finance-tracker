import { authClient, getAuthUrlDiagnostics } from './_auth.js'
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

            const { data } = await authClient.getSession({
                fetchOptions: {
                    headers: incomingHeaders
                }
            })

            if (!data?.user) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }

            const { user } = data
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

            const { data } = await authClient.getSession({
                fetchOptions: {
                    headers: incomingHeaders
                }
            })

            if (!data?.user) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }

            const { user } = data
            const body = req.body || {}
            const fullName = body.fullName || user.name || 'Unknown'

            // Ensure user exists in our users table
            // Handle both ID conflict and email conflict (legacy user migration)
            try {
                await queryOne(
                    `INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3)
                     ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
                    [user.id, user.email, fullName]
                )
            } catch (dbError: any) {
                if (dbError.code === '23505' && dbError.message?.includes('email')) {
                    // A legacy user with this email exists under a different ID.
                    // Migrate all their data to the new Neon Auth ID.
                    console.warn('Migrating legacy user to Neon Auth ID:', user.id)
                    try {
                        const legacy = await queryOne<{ id: string }>(
                            'SELECT id FROM users WHERE email = $1 AND id != $2', [user.email, user.id]
                        )
                        if (legacy) {
                            const oldId = legacy.id
                            // Temporarily rename email to avoid unique constraint during insert
                            await queryOne(`UPDATE users SET email = 'migrating_' || email WHERE id = $1`, [oldId])
                            await queryOne(
                                `INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name`,
                                [user.id, user.email, fullName]
                            )
                            // Migrate all child table references
                            const childTables = ['debt_payments', 'debts', 'ai_insights', 'goals', 'budgets', 'transactions', 'categories', 'accounts', 'profiles']
                            for (const table of childTables) {
                                await queryOne(`UPDATE ${table} SET user_id = $1 WHERE user_id = $2`, [user.id, oldId])
                            }
                            await queryOne('DELETE FROM users WHERE id = $1', [oldId])
                            console.log('Legacy user migration complete.')
                        }
                    } catch (migrationError) {
                        console.error('Legacy user migration failed:', migrationError)
                    }
                } else {
                    console.error('Database sync error (users table):', dbError)
                }
            }

            // Ensure profile exists in our database
            try {
                await queryOne(
                    'INSERT INTO profiles (user_id, full_name, currency) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING',
                    [user.id, fullName, 'USD'],
                )
            } catch (dbError: any) {
                console.error('Database sync error (profiles table):', dbError)
            }

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

            const incomingHeaders = new Headers()
            if (req.headers?.origin) incomingHeaders.set('origin', req.headers.origin as string)
            if (req.headers?.host) incomingHeaders.set('host', req.headers.host as string)

            const { data, error } = await authClient.signUp.email({
                email,
                password,
                name: fullName,
                fetchOptions: {
                    headers: incomingHeaders
                }
            })

            if (error) {
                console.error('Neon Auth signup error:', error, getAuthUrlDiagnostics())
                res.status(400).json({
                    error: error.message || 'Signup failed',
                    diagnostics: getAuthUrlDiagnostics(),
                })
                return
            }

            if (data?.user) {
                const token = data.token

                // Ensure user exists in our users table (required for foreign key in profiles)
                // Handle email conflict from legacy users
                try {
                    await queryOne(
                        `INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3)
                         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
                        [data.user.id, email, fullName]
                    )
                } catch (dbError: any) {
                    if (dbError.code === '23505' && dbError.message?.includes('email')) {
                        // Legacy user migration during signup
                        console.warn('Migrating legacy user during signup for Neon Auth ID:', data.user.id)
                        try {
                            const legacy = await queryOne<{ id: string }>(
                                'SELECT id FROM users WHERE email = $1 AND id != $2', [email, data.user.id]
                            )
                            if (legacy) {
                                const oldId = legacy.id
                                await queryOne(`UPDATE users SET email = 'migrating_' || email WHERE id = $1`, [oldId])
                                await queryOne(
                                    `INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name`,
                                    [data.user.id, email, fullName]
                                )
                                const childTables = ['debt_payments', 'debts', 'ai_insights', 'goals', 'budgets', 'transactions', 'categories', 'accounts', 'profiles']
                                for (const table of childTables) {
                                    await queryOne(`UPDATE ${table} SET user_id = $1 WHERE user_id = $2`, [data.user.id, oldId])
                                }
                                await queryOne('DELETE FROM users WHERE id = $1', [oldId])
                                console.log('Legacy user migration during signup complete.')
                            }
                        } catch (migrationError) {
                            console.error('Legacy user migration during signup failed:', migrationError)
                        }
                    } else {
                        console.error('Database sync error during signup (users table):', dbError)
                    }
                }

                // Ensure profile exists in our database
                try {
                    await queryOne(
                        'INSERT INTO profiles (user_id, full_name, currency) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING RETURNING user_id',
                        [data.user.id, fullName, 'USD'],
                    )
                } catch (dbError: any) {
                    console.error('Database sync error during signup (profiles table):', dbError)
                }

                res.status(201).json({
                    token,
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
        } catch (error: any) {
            console.error('Signup error:', error)
            if (error?.status === 400 || error?.status === 409 || error?.message?.includes('already exists')) {
                res.status(400).json({ error: error?.message || 'Invalid registration details' })
                return;
            }
            res.status(500).json({ error: 'Server error' })
        }
        return
    }

    // Handle /api/auth?action=login
    if (action === 'login') {
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

            const incomingHeaders = new Headers()
            if (req.headers?.origin) incomingHeaders.set('origin', req.headers.origin as string)
            if (req.headers?.host) incomingHeaders.set('host', req.headers.host as string)

            const { data, error } = await authClient.signIn.email({
                email,
                password,
                fetchOptions: {
                    headers: incomingHeaders
                }
            })

            if (error) {
                recordFailedAttempt(clientId, 'login')
                console.error('Neon Auth login error:', error, getAuthUrlDiagnostics())
                const message = error.message?.includes('missing authentication credentials')
                    ? error.message
                    : 'Invalid email or password'
                res.status(401).json({
                    error: message,
                    diagnostics: getAuthUrlDiagnostics(),
                })
                return
            }

            if (data?.user) {
                try {
                    await queryOne(
                        `INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3)
                         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
                        [data.user.id, data.user.email, data.user.name || 'Unknown']
                    )
                    await queryOne(
                        'INSERT INTO profiles (user_id, full_name, currency) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING',
                        [data.user.id, data.user.name || 'Unknown', 'USD'],
                    )
                } catch (dbError) {
                    console.error('Database sync error during login:', dbError)
                }

                res.status(200).json({
                    token: data.token,
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
        } catch (error: any) {
            console.error('Login error detailed:', error, error?.cause, getAuthUrlDiagnostics());
            try {
                const fs = await import('fs');
                fs.appendFileSync('error.log', JSON.stringify({ message: error.message, stack: error.stack, cause: error.cause }) + '\n');
            } catch(e) {}
            
            // better-auth throws APIError for 400/401 responses
            if (error?.message?.includes('Email not verified')) {
                res.status(403).json({
                    error: 'Email not verified. Please verify your email before signing in.',
                    diagnostics: getAuthUrlDiagnostics(),
                })
                return;
            }

            if (error?.message === 'Invalid email or password' || error?.status === 401 || error?.status === 400) {
                const message = error?.message?.includes('missing authentication credentials')
                    ? error.message
                    : 'Invalid email or password'
                res.status(401).json({
                    error: message,
                    diagnostics: getAuthUrlDiagnostics(),
                })
                return;
            }
            
            res.status(500).json({
                error: `Server error: ${error?.message || 'Unknown'}`,
                diagnostics: getAuthUrlDiagnostics(),
            })
        }
        return
    }

    res.status(405).json({ error: 'Method not allowed' })
}
