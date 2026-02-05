import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'

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

    useEffect(() => {
        const checkUser = async () => {
            try {
                const res = await api.auth.me()
                const authedUser = res.user as User
                setUser(authedUser)
                setSession({ user: authedUser, access_token: 'server-session' })
            } catch {
                setUser(null)
                setSession(null)
            } finally {
                setLoading(false)
            }
        }

        checkUser()
    }, [])



    const signIn = async (email: string, password: string) => {
        try {
            setLoading(true)
            const res = await api.auth.login(email, password)
            const authedUser = res.user as User
            setUser(authedUser)
            setSession({ user: authedUser, access_token: 'server-session' })
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
            await api.auth.signup(email, password, fullName)
            return { error: null }
        } catch (err) {
            console.error('Sign up error:', err)
            return { error: err as Error }
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
        await api.auth.logout()
        setUser(null)
        setSession(null)
    }

    const resetPassword = async (email: string) => {
        // TODO: Implement real password reset
        console.log('Password reset requested for:', email)
        return { error: null }
    }

    const updateProfile = async (data: { full_name?: string; avatar_url?: string }) => {
        if (!user) return { error: new Error('No user logged in') }

        try {
            await api.profile.update({
                full_name: data.full_name,
                avatar_url: data.avatar_url,
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
