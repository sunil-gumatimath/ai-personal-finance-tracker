import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
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

    const sessionData = authClient.useSession()

    useEffect(() => {
        if (!sessionData.isPending) {
            if (sessionData.data) {
                const neonUser = sessionData.data.user
                const authedUser: User = {
                    id: neonUser.id,
                    email: neonUser.email,
                    user_metadata: { 
                        full_name: neonUser.name || '', 
                        avatar_url: neonUser.image 
                    },
                    app_metadata: {},
                    aud: 'authenticated',
                    created_at: neonUser.createdAt.toISOString()
                }
                setUser(authedUser)
                setSession({ user: authedUser, access_token: sessionData.data.session.token })
            } else {
                setUser(null)
                setSession(null)
            }
            setLoading(false)
        }
    }, [sessionData.data, sessionData.isPending])

    const signIn = async (email: string, password: string) => {
        try {
            setLoading(true)
            const { data, error } = await authClient.signIn.email({ email, password })
            if (error) throw error
            
            if (data?.user) {
                const authedUser: User = {
                    id: data.user.id,
                    email: data.user.email,
                    user_metadata: { 
                        full_name: data.user.name || '', 
                        avatar_url: data.user.image 
                    },
                    app_metadata: {},
                    aud: 'authenticated',
                    created_at: data.user.createdAt.toISOString()
                }
                setUser(authedUser)
                setSession({ user: authedUser, access_token: data.token })
                
                // Sync user to our database in case it's missing
                await api.auth.sync(data.user.name || 'Unknown').catch(err => {
                    console.error('Failed to sync user profile:', err)
                })
            }
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
            const { error } = await authClient.signUp.email({ email, password, name: fullName })
            if (error) throw error

            // Sync user to our database
            await api.auth.sync(fullName).catch(err => {
                console.error('Failed to sync user profile:', err)
            })

            return { error: null }
        } catch (err) {
            console.error('Sign up error:', err)
            return { error: err as Error }
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
        await authClient.signOut()
        setUser(null)
        setSession(null)
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
