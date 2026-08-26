import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/system/Logo'

type CredentialField = 'email' | 'password'

/**
 * Best-effort attribution of a failed signup to the offending field so the
 * inline error can mark it aria-invalid. Unrecognized messages stay generic.
 */
function classifyCredentialError(message: string): CredentialField | null {
    if (/password/i.test(message)) return 'password'
    if (/e-?mail|user|account|credential/i.test(message)) return 'email'
    return null
}

export function Signup() {
    const navigate = useNavigate()
    const { signUp } = useAuth()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [formError, setFormError] = useState<string | null>(null)
    const [errorField, setErrorField] = useState<CredentialField | null>(null)
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
    })

    const passwordRequirements = [
        { met: formData.password.length >= 8, text: 'At least 8 characters' },
        { met: /[A-Z]/.test(formData.password), text: 'One uppercase letter' },
        { met: /[a-z]/.test(formData.password), text: 'One lowercase letter' },
        { met: /[0-9]/.test(formData.password), text: 'One number' },
    ]

    const passwordMismatch =
        formData.confirmPassword !== '' &&
        formData.password !== formData.confirmPassword

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData({ ...formData, [field]: value })
        if (field === 'password' || field === 'confirmPassword') {
            setValidationError(null)
        }
        if (formError || errorField) {
            setFormError(null)
            setErrorField(null)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (isSubmitting) return

        if (formData.password !== formData.confirmPassword) {
            setValidationError('Passwords do not match')
            return
        }

        if (!passwordRequirements.every((req) => req.met)) {
            setValidationError('Please meet all password requirements')
            return
        }

        setIsSubmitting(true)
        setFormError(null)
        setErrorField(null)

        try {
            await signUp(formData.email, formData.password, formData.fullName)
            // The account is created but NOT signed in yet (email verification
            // is pending), so route to /login where PublicRoute still applies.
            toast.success('Account created! Please check your email to verify.')
            navigate('/login', { replace: true })
        } catch (error: unknown) {
            console.error('Signup error:', error)
            const message =
                error instanceof Error ? error.message : 'Failed to create account'
            // Single error channel: inline alert (no duplicate toast).
            setFormError(message)
            setErrorField(classifyCredentialError(message))
        } finally {
            setIsSubmitting(false)
        }
    }

    const submitError = validationError ?? formError
    const describedBy = (field: CredentialField) =>
        formError && (errorField === field || errorField === null)
            ? 'signup-error'
            : undefined

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
            <div className="w-full max-w-md space-y-8">
                {/* Logo */}
                <div className="flex flex-col items-center">
                    <Logo size="lg" showText={true} vertical={true} />
                </div>

                {/* Signup Card */}
                <Card className="border-border/50 shadow-xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl">Create an account</CardTitle>
                        <CardDescription>
                            Enter your details to get started
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input
                                    id="fullName"
                                    placeholder="John Doe"
                                    value={formData.fullName}
                                    onChange={(e) =>
                                        updateField('fullName', e.target.value)
                                    }
                                    required
                                    autoComplete="name"
                                    autoFocus
                                />
                            </div>

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
                                    aria-invalid={
                                        errorField === 'email' || undefined
                                    }
                                    aria-describedby={describedBy('email')}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
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
                                        autoComplete="new-password"
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
                                {formData.password && (
                                    <ul className="mt-2 space-y-1">
                                        {passwordRequirements.map((req) => (
                                            <li
                                                key={req.text}
                                                className={`flex items-center gap-2 text-xs ${req.met ? 'text-green-500' : 'text-muted-foreground'}`}
                                            >
                                                <Check
                                                    className={`h-3 w-3 ${req.met ? 'opacity-100' : 'opacity-30'}`}
                                                />
                                                {req.text}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.confirmPassword}
                                    onChange={(e) =>
                                        updateField('confirmPassword', e.target.value)
                                    }
                                    required
                                    autoComplete="new-password"
                                    aria-invalid={passwordMismatch || undefined}
                                    aria-describedby={
                                        passwordMismatch
                                            ? 'confirm-password-error'
                                            : undefined
                                    }
                                />
                                {passwordMismatch && (
                                    <p
                                        role="alert"
                                        id="confirm-password-error"
                                        className="text-xs text-destructive"
                                    >
                                        Passwords do not match
                                    </p>
                                )}
                            </div>

                            {submitError && (
                                <p
                                    role="alert"
                                    id="signup-error"
                                    className="text-sm text-destructive"
                                >
                                    {submitError}
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
                                        Creating account...
                                    </>
                                ) : (
                                    'Create account'
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 text-center text-sm">
                            Already have an account?{' '}
                            <Link to="/login" className="text-primary hover:underline">
                                Sign in
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
