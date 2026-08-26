import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/system/Logo'

type CredentialField = 'email' | 'password'

/**
 * Best-effort attribution of a failed sign-in to the offending field so the
 * inline error can mark it aria-invalid. Unrecognized messages stay generic.
 */
function classifyCredentialError(message: string): CredentialField | null {
    if (/password/i.test(message)) return 'password'
    if (/e-?mail|user|account|credential/i.test(message)) return 'email'
    return null
}

export function Login() {
    const navigate = useNavigate()
    const { signIn } = useAuth()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [errorField, setErrorField] = useState<CredentialField | null>(null)
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    })

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData({ ...formData, [field]: value })
        if (formError || errorField) {
            setFormError(null)
            setErrorField(null)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isSubmitting) return
        setIsSubmitting(true)
        setFormError(null)
        setErrorField(null)

        try {
            await signIn(formData.email, formData.password)
            toast.success('Welcome back!')
            navigate('/')
        } catch (error: unknown) {
            console.error('Login error:', error)
            const message =
                error instanceof Error ? error.message : 'Failed to sign in'
            // Single error channel: inline alert (no duplicate toast).
            setFormError(message)
            setErrorField(classifyCredentialError(message))
        } finally {
            setIsSubmitting(false)
        }
    }

    const describedBy = (field: CredentialField) =>
        formError && (errorField === field || errorField === null)
            ? 'login-error'
            : undefined

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
            <div className="w-full max-w-md space-y-8">
                {/* Logo */}
                <div className="flex flex-col items-center">
                    <Logo size="lg" showText={true} vertical={true} />
                </div>

                {/* Login Card */}
                <Card className="border-border/50 shadow-xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl">Welcome back</CardTitle>
                        <CardDescription>
                            Enter your credentials to access your account
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="user@gmail.com"
                                    value={formData.email}
                                    onChange={(e) =>
                                        updateField('email', e.target.value)
                                    }
                                    required
                                    autoComplete="email"
                                    autoFocus
                                    aria-invalid={
                                        errorField === 'email' || undefined
                                    }
                                    aria-describedby={describedBy('email')}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link
                                        to="/forgot-password"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={(e) =>
                                            updateField('password', e.target.value)
                                        }
                                        required
                                        autoComplete="current-password"
                                        className="pr-10"
                                        aria-invalid={
                                            errorField === 'password' || undefined
                                        }
                                        aria-describedby={describedBy('password')}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent cursor-pointer"
                                        onClick={() =>
                                            setShowPassword((current) => !current)
                                        }
                                        aria-label={
                                            showPassword
                                                ? 'Hide password'
                                                : 'Show password'
                                        }
                                        aria-pressed={showPassword}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {formError && (
                                <p
                                    role="alert"
                                    id="login-error"
                                    className="text-sm text-destructive"
                                >
                                    {formError}
                                </p>
                            )}

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign in'
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 text-center text-sm">
                            Don't have an account?{' '}
                            <Link to="/signup" className="text-primary hover:underline">
                                Sign up
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Demo Note */}
                {import.meta.env.VITE_DEMO_MODE === 'true' && (
                    <p className="text-center text-sm text-muted-foreground">
                        Running in demo mode? Data persistence requires database setup.
                    </p>
                )}
            </div>
        </div>
    )
}
