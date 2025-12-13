import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
    user: User | null
    session: Session | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
    resetPassword: (email: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession()
            .then(async ({ data: { session } }) => {
                setSession(session)

                if (session?.user) {
                    setUser(session.user)
                    setLoading(false)
                } else if (import.meta.env.DEV) {
                    // Try auto-login, fallback to offline mock if it fails
                    try {
                        await autoLoginDemoUser()
                    } catch (e) {
                        console.warn('Auto-login failed, falling back to offline demo user:', e)
                        setOfflineDemoUser()
                    }
                    setLoading(false)
                } else {
                    setUser(null)
                    setLoading(false)
                }
            })
            .catch((err) => {
                console.warn('Supabase connection failed, using offline demo user:', err)
                if (import.meta.env.DEV) {
                    setOfflineDemoUser()
                }
                setLoading(false)
            })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session)
                setUser(session?.user ?? null)
                setLoading(false)
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    const setOfflineDemoUser = () => {
        setUser({
            id: 'offline-demo-user',
            email: 'demo@example.com',
            app_metadata: {},
            user_metadata: { full_name: 'Demo User (Offline)', avatar_url: '' },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        } as User)
    }

    const autoLoginDemoUser = async () => {
        const email = 'demo@example.com'
        const password = 'demo123password'

        try {
            // Try to sign in
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            // If sign in fails (likely user doesn't exist), try to sign up
            if (signInError) {
                console.log('Demo user not found, creating...')
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: 'Demo User',
                        },
                    },
                })

                if (signUpError) {
                    console.error('Failed to create demo user:', signUpError)
                } else {
                    console.log('Demo user created and logged in')
                }
            } else {
                console.log('Demo user logged in')
            }
        } catch (err) {
            console.error('Auto login error:', err)
        }
    }



    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        return { error: error as Error | null }
    }

    const signUp = async (email: string, password: string, fullName: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        })
        return { error: error as Error | null }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
    }

    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        return { error: error as Error | null }
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
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
