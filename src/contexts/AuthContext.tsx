import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api-client'
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

interface AuthContextType {
    user: User | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
    resetPassword: (email: string) => Promise<{ error: Error | null }>
    updateProfile: (data: { full_name?: string; avatar_url?: string }) => Promise<{ error: Error | null }>
    deleteAccount: () => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** Routes where an auth failure is expected — no forced redirect there. */
const PUBLIC_AUTH_ROUTES = ['/login', '/signup', '/forgot-password']

/**
 * Extracts an Error from unknown throwables / SDK error objects without ever
 * rendering "[object Object]".
 */
function toError(err: unknown): Error {
    if (err instanceof Error) return err
    const message =
        typeof (err as { message?: unknown } | null)?.message === 'string'
            ? (err as { message: string }).message
            : typeof err === 'string'
                ? err
                : 'Something went wrong. Please try again.'
    return new Error(message)
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate()
    const location = useLocation()

    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    const restoreSession = useCallback(async () => {
        // Remove bearer tokens left by older releases. Authentication now
        // uses an HttpOnly same-site cookie that JavaScript cannot read.
        localStorage.removeItem('auth_token')

        try {
            const { user: authedUser } = await api.auth.me()
            setUser(authedUser)
        } catch (err) {
            console.error('Failed to restore auth session:', err)
            setUser(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        restoreSession()
    }, [restoreSession])

    const signIn = useCallback(async (email: string, password: string) => {
        try {
            setLoading(true)
            const { user: authedUser } = await api.auth.login(email, password)
            setUser(authedUser)
            return { error: null }
        } catch (err) {
            console.error('Sign in error:', err)
            return { error: toError(err) }
        } finally {
            setLoading(false)
        }
    }, [])

    const signUp = useCallback(async (email: string, password: string, fullName: string) => {
        try {
            setLoading(true)
            const { user: authedUser } = await api.auth.signup(email, password, fullName)
            setUser(authedUser)

            return { error: null }
        } catch (err) {
            console.error('Sign up error:', err)
            return { error: toError(err) }
        } finally {
            setLoading(false)
        }
    }, [])

    const signOut = useCallback(async () => {
        await api.auth.logout().catch(() => undefined)
        await authClient.signOut().catch(() => undefined)
        localStorage.removeItem('auth_token')
        setUser(null)
    }, [])

    const resetPassword = useCallback(async (email: string) => {
        try {
            // Neon Auth (via better-auth) uses emailOtp for forgot password flow.
            // The reset link is usually configured in the Neon Console.
            const { error } = await authClient.forgetPassword.emailOtp({
                email
            })
            return { error: error ? toError(error) : null }
        } catch (err) {
            return { error: toError(err) }
        }
    }, [])

    const deleteAccount = useCallback(async () => {
        try {
            setLoading(true)
            await api.auth.deleteAccount()
            await authClient.signOut().catch(() => undefined)
            localStorage.removeItem('auth_token')
            setUser(null)
            return { error: null }
        } catch (err) {
            console.error('Delete account error:', err)
            return { error: toError(err) }
        } finally {
            setLoading(false)
        }
    }, [])

    // Global 401/403 handling: api-client dispatches this event on any auth
    // error outside the public routes; sign out and send the user to /login.
    useEffect(() => {
        const handleSessionExpired = () => {
            if (PUBLIC_AUTH_ROUTES.includes(location.pathname)) return
            void (async () => {
                await signOut()
                navigate('/login', { replace: true })
            })()
        }
        window.addEventListener('app:session-expired', handleSessionExpired)
        return () =>
            window.removeEventListener('app:session-expired', handleSessionExpired)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, navigate])

    const updateProfile = useCallback(async (data: { full_name?: string; avatar_url?: string }) => {
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

            return { error: null }
        } catch (err) {
            return { error: toError(err) }
        }
    }, [user])

    // Memoized so consumers don't re-render on unrelated provider renders.
    const value = useMemo(
        () => ({
            user,
            loading,
            signIn,
            signUp,
            signOut,
            resetPassword,
            updateProfile,
            deleteAccount,
        }),
        [user, loading, signIn, signUp, signOut, resetPassword, updateProfile, deleteAccount],
    )

    return (
        <AuthContext.Provider value={value}>
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
