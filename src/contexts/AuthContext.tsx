import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Define replacement types for Supabase types
type User = {
    id: string;
    email?: string;
    user_metadata: { [key: string]: any };
    app_metadata: { [key: string]: any };
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
        // Check for existing user in local storage
        const storedUser = localStorage.getItem('finance_user');
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                setSession({ user: parsedUser, access_token: 'demo-token' });
            } catch (e) {
                console.error('Failed to parse stored user', e);
            }
        }
        setLoading(false);
    }, [])



    const signIn = async (email: string, _password: string) => {
        // Simulation of sign in
        const newUser = {
            id: 'demo-user-' + Math.random().toString(36).substr(2, 9),
            email,
            app_metadata: {},
            user_metadata: { full_name: email.split('@')[0], avatar_url: '' },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        };
        setUser(newUser);
        setSession({ user: newUser, access_token: 'mock-token' });
        localStorage.setItem('finance_user', JSON.stringify(newUser));

        return { error: null }
    }

    const signUp = async (email: string, _password: string, fullName: string) => {
        // Simulation of sign up
        const newUser = {
            id: 'demo-user-' + Math.random().toString(36).substr(2, 9),
            email,
            app_metadata: {},
            user_metadata: { full_name: fullName, avatar_url: '' },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        };
        setUser(newUser);
        setSession({ user: newUser, access_token: 'mock-token' });
        localStorage.setItem('finance_user', JSON.stringify(newUser));

        return { error: null }
    }

    const signOut = async () => {
        setUser(null)
        setSession(null)
        localStorage.removeItem('finance_user');
    }

    const resetPassword = async (_email: string) => {
        return { error: null }
    }

    const updateProfile = async (data: { full_name?: string; avatar_url?: string }) => {
        if (!user) return { error: new Error('No user logged in') }

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
    }

    return (
        <AuthContext.Provider
            value={{
                user: user as any, // Cast to any to satisfy existing types if strictly typed elsewhere
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
