import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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

export function AuthProvider({ children }: { children: ReactNode }) {

    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const restoreSession = async () => {
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
        }

        restoreSession()
    }, [])

    const signIn = async (email: string, password: string) => {
        try {
            setLoading(true)
            const { user: authedUser } = await api.auth.login(email, password)
            setUser(authedUser)
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
            const { user: authedUser } = await api.auth.signup(email, password, fullName)
            setUser(authedUser)

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

    const deleteAccount = async () => {
        try {
            setLoading(true)
            await api.auth.deleteAccount()
            await authClient.signOut().catch(() => undefined)
            localStorage.removeItem('auth_token')
            setUser(null)
            return { error: null }
        } catch (err) {
            console.error('Delete account error:', err)
            return { error: err as Error }
        } finally {
            setLoading(false)
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

            return { error: null }
        } catch (err) {
            return { error: err as Error }
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                signIn,
                signUp,
                signOut,
                resetPassword,
                updateProfile,
                deleteAccount,
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
