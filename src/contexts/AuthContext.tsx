import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setApiAuthToken } from '@/lib/api'
import { authClient } from '@/lib/auth'

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

    const buildSession = (authedUser: User, token: string): Session => ({
        user: authedUser,
        access_token: token,
    })

    useEffect(() => {
        const restoreSession = async () => {
            const token = localStorage.getItem('auth_token')
            if (!token) {
                setUser(null)
                setSession(null)
                setApiAuthToken(null)
                setLoading(false)
                return
            }

            try {
                setApiAuthToken(token)
                const { user: authedUser } = await api.auth.me()
                setUser(authedUser)
                setSession(buildSession(authedUser, token))
            } catch (err) {
                console.error('Failed to restore auth session:', err)
                localStorage.removeItem('auth_token')
                setApiAuthToken(null)
                setUser(null)
                setSession(null)
            } finally {
                setLoading(false)
            }
        }

        restoreSession()
    }, [])

    const signIn = async (email: string, password: string) => {
        try {
            setLoading(true)
            const { user: authedUser, token } = await api.auth.login(email, password)
            if (!token) {
                throw new Error('Login succeeded but no auth token was returned')
            }
            localStorage.setItem('auth_token', token)
            setApiAuthToken(token)
            setUser(authedUser)
            setSession(buildSession(authedUser, token))
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
            const { user: authedUser, token } = await api.auth.signup(email, password, fullName)
            if (token) {
                localStorage.setItem('auth_token', token)
                setApiAuthToken(token)
                setUser(authedUser)
                setSession(buildSession(authedUser, token))
            }

            return { error: null }
        } catch (err) {
            console.error('Sign up error:', err)
            return { error: err as Error }
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
        await api.auth.logout().catch(() => undefined)
        await authClient.signOut().catch(() => undefined)
        localStorage.removeItem('auth_token')
        setUser(null)
        setSession(null)
        setApiAuthToken(null)
    }

    const resetPassword = async (email: string) => {
        try {
            // Neon Auth (via better-auth) uses emailOtp for forgot password flow.
            // The reset link is usually configured in the Neon Console.
            const { error } = await authClient.forgetPassword.emailOtp({ 
                email
            })
            return { error: (error as unknown) as Error }
        } catch (err) {
            return { error: err as Error }
        }
    }

    const updateProfile = async (data: { full_name?: string; avatar_url?: string }) => {
        if (!user) return { error: new Error('No user logged in') }

        try {
            // Update in our database for custom preferences/currency etc.
            await api.profile.update({
                full_name: data.full_name,
                avatar_url: data.avatar_url,
            })

            // Update in Neon Auth
            await authClient.updateUser({
                name: data.full_name,
                image: data.avatar_url
            })

            const updatedUser = {
                ...user,
                user_metadata: {
                    ...user.user_metadata,
                    ...data
                }
            }

            setUser(updatedUser)
            setSession(prev => prev ? { ...prev, user: updatedUser } : null)

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
