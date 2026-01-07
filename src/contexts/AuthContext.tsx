import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { query } from '@/lib/database'

// Define types for Auth
type UserMetadata = {
    full_name?: string;
    avatar_url?: string | null;
    [key: string]: unknown;
}

type User = {
    id: string;
    email?: string;
    user_metadata: UserMetadata;
    app_metadata: Record<string, unknown>;
    aud: string;
    created_at: string;
}

type Session = {
    user: User;
    access_token: string;
}

interface DbUser {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
    created_at: string;
}

interface AuthContextType {
    user: User | null
    session: Session | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
    resetPassword: (email: string) => Promise<{ error: Error | null }>
    updateProfile: (data: { full_name?: string; avatar_url?: string }) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {

    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check for existing user in local storage
        const checkUser = async () => {
            const storedUser = localStorage.getItem('finance_user');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);

                    // Verify user exists in DB to prevent foreign key errors with stale IDs
                    const dbUser = await query<DbUser>('SELECT id FROM users WHERE id = $1', [parsedUser.id]);

                    if (dbUser.rows.length > 0) {
                        setUser(parsedUser);
                        setSession({ user: parsedUser, access_token: 'demo-token' });
                    } else {
                        // Stale ID - clear storage
                        localStorage.removeItem('finance_user');
                        setUser(null);
                        setSession(null);
                    }
                } catch (e) {
                    console.error('Failed to parse or verify stored user:', e);
                    localStorage.removeItem('finance_user');
                }
            }
            setLoading(false);
        };

        checkUser();
    }, [])



    const signIn = async (email: string, password: string) => {
        try {
            setLoading(true)
            const { rows } = await query<DbUser>('SELECT * FROM users WHERE email = $1 AND encrypted_password = $2', [email, password])

            if (rows.length === 0) {
                setLoading(false)
                return { error: new Error('Invalid email or password') }
            }

            const user = rows[0]
            const sessionData = {
                user: {
                    id: user.id,
                    email: user.email,
                    user_metadata: { full_name: user.full_name, avatar_url: user.avatar_url },
                    app_metadata: {},
                    aud: 'authenticated',
                    created_at: user.created_at
                },
                access_token: 'auth-token-' + user.id // Simple token simulation
            }

            setUser(sessionData.user)
            setSession(sessionData)
            localStorage.setItem('finance_user', JSON.stringify(sessionData.user))

            // Update last sign in
            await query('UPDATE users SET last_sign_in_at = NOW() WHERE id = $1', [user.id])

            return { error: null }
        } catch (err) {
            console.error('Sign in error:', err)
            return { error: err as Error }
        } finally {
            setLoading(false)
        }
    }

    const signUp = async (email: string, password: string, fullName: string) => {
        try {
            setLoading(true)
            // Check existing
            const { rows: existing } = await query<DbUser>('SELECT id FROM users WHERE email = $1', [email])
            if (existing.length > 0) {
                setLoading(false)
                return { error: new Error('User already exists') }
            }

            // Create User
            const { rows: newUsers } = await query<DbUser>(
                'INSERT INTO users (email, encrypted_password, full_name) VALUES ($1, $2, $3) RETURNING *',
                [email, password, fullName]
            )
            const newUser = newUsers[0]

            // Create Profile
            await query(
                'INSERT INTO profiles (user_id, full_name, currency) VALUES ($1, $2, $3)',
                [newUser.id, fullName, 'USD']
            )

            const sessionData = {
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    user_metadata: { full_name: newUser.full_name, avatar_url: null },
                    app_metadata: {},
                    aud: 'authenticated',
                    created_at: newUser.created_at
                },
                access_token: 'auth-token-' + newUser.id
            }

            setUser(sessionData.user)
            setSession(sessionData)
            localStorage.setItem('finance_user', JSON.stringify(sessionData.user))

            return { error: null }
        } catch (err) {
            console.error('Sign up error:', err)
            return { error: err as Error }
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
        setUser(null)
        setSession(null)
        localStorage.removeItem('finance_user')
    }

    const resetPassword = async (email: string) => {
        // TODO: Implement real password reset
        console.log('Password reset requested for:', email)
        return { error: null }
    }

    const updateProfile = async (data: { full_name?: string; avatar_url?: string }) => {
        if (!user) return { error: new Error('No user logged in') }

        try {
            const updates: string[] = []
            const values: (string | undefined)[] = []
            let i = 1

            if (data.full_name !== undefined) {
                updates.push(`full_name = $${i++}`)
                values.push(data.full_name)
            }
            if (data.avatar_url !== undefined) {
                updates.push(`avatar_url = $${i++}`)
                values.push(data.avatar_url)
            }

            if (updates.length > 0) {
                values.push(user.id)
                await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`, values)
                await query(`UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $${i}`, values)
            }

            const updatedUser = {
                ...user,
                user_metadata: {
                    ...user.user_metadata,
                    ...data
                }
            }

            setUser(updatedUser)
            setSession(prev => prev ? { ...prev, user: updatedUser } : null)
            localStorage.setItem('finance_user', JSON.stringify(updatedUser))

            return { error: null }
        } catch (err) {
            return { error: err as Error }
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                loading,
                signIn,
                signUp,
                signOut,
                resetPassword,
                updateProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
