import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, isPublicAuthRoute } from '@/lib/api-client'
import { authClient } from '@/lib/auth'
import { ApiError } from '@/lib/errors'

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
    /**
     * True ONLY during the initial session bootstrap on page load. Route
     * guards block rendering on this flag alone — mutations never touch it,
     * so pages own their own pending UI.
     */
    initializing: boolean
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string, fullName: string) => Promise<void>
    signOut: () => Promise<void>
    resetPassword: (email: string) => Promise<{ error: Error | null }>
    updateProfile: (data: { full_name?: string; avatar_url?: string }) => Promise<{ error: Error | null }>
    deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

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
    const [initializing, setInitializing] = useState(true)

    const restoreSession = useCallback(async () => {
        // Remove bearer tokens left by older releases. Authentication now
        // uses an HttpOnly same-site cookie that JavaScript cannot read.
        //
        // This MUST stay inside the try. `localStorage` throws SecurityError in
        // Safari Private Browsing, when `dom.storage.enabled=false`, under
        // enterprise policy, and in sandboxed iframes. When it threw here —
        // before the try — the `finally` never ran, `initializing` stayed
        // `true` forever, and the app sat on an unrecoverable
        // "Checking your session…" loader with no login form and no error
        // boundary to catch it.
        try {
            localStorage.removeItem('auth_token')
        } catch {
            // Storage unavailable; the cookie is the credential either way.
        }

        try {
            const { user: authedUser } = await api.auth.me()
            setUser(authedUser)
        } catch (err) {
            // A network failure is not the same as "signed out" — say so,
            // otherwise a flaky connection silently bounces a valid session to
            // the login page with no message and no retry.
            if (err instanceof ApiError && err.code === 'NETWORK_ERROR') {
                console.error('Could not reach the server to restore the session:', err)
            } else {
                console.error('Failed to restore auth session:', err)
            }
            setUser(null)
        } finally {
            setInitializing(false)
        }
    }, [])

    useEffect(() => {
        void restoreSession()
    }, [restoreSession])

    /**
     * Mutations below NEVER flip a global loading flag and REJECT with the
     * Error on failure — callers own their pending UI and error handling.
     */

    const signIn = useCallback(async (email: string, password: string) => {
        try {
            const { user: authedUser } = await api.auth.login(email, password)
            setUser(authedUser)
        } catch (err) {
            console.error('Sign in error:', err)
            throw toError(err)
        }
    }, [])

    const signUp = useCallback(async (email: string, password: string, fullName: string) => {
        try {
            // Deliberately do NOT adopt any session the backend may return:
            // signup leaves email verification pending, so the account is not
            // signed in yet. The user completes verification / signs in on
            // /login — keeping `user` null here prevents PublicRoute from
            // bouncing them to "/" before they can verify.
            await api.auth.signup(email, password, fullName)
        } catch (err) {
            console.error('Sign up error:', err)
            throw toError(err)
        }
    }, [])

    const signOut = useCallback(async () => {
        // Clear local state FIRST and unconditionally. Every step below is
        // best-effort: a storage or provider failure must never leave the user
        // apparently signed in, and must never throw out of a sign-out (the
        // header awaits this, so a throw would skip its navigation).
        setUser(null)
        try {
            localStorage.removeItem('auth_token')
        } catch {
            // Storage unavailable.
        }
        await api.auth.logout().catch(() => undefined)
        await authClient.signOut().catch(() => undefined)
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
            await api.auth.deleteAccount()
            setUser(null)
            try {
                localStorage.removeItem('auth_token')
            } catch {
                // Storage unavailable.
            }
            await authClient.signOut().catch(() => undefined)
        } catch (err) {
            console.error('Delete account error:', err)
            throw toError(err)
        }
    }, [])

    // Global 401/403 handling: api-client dispatches this event on any auth
    // error outside the public routes; sign out and send the user to /login.
    //
    // Re-entrancy guarded: a page that fires several requests in parallel
    // (Dashboard issues 5+, `useFinancialHealth` a `Promise.all` of 3) will
    // dispatch one event per 401. Without the latch that meant N concurrent
    // sign-outs, each doing a logout round-trip, plus N competing navigations.
    useEffect(() => {
        let handling = false
        const handleSessionExpired = () => {
            if (handling) return
            if (isPublicAuthRoute(location.pathname)) return
            handling = true
            void (async () => {
                try {
                    await signOut()
                    navigate('/login', { replace: true })
                } finally {
                    handling = false
                }
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
            initializing,
            signIn,
            signUp,
            signOut,
            resetPassword,
            updateProfile,
            deleteAccount,
        }),
        [user, initializing, signIn, signUp, signOut, resetPassword, updateProfile, deleteAccount],
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
