import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/system/Logo'

export function ForgotPassword() {
    const { resetPassword } = useAuth()
    const [email, setEmail] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isSending) return
        setIsSending(true)
        setFormError(null)
        try {
            const { error } = await resetPassword(email)
            if (error) throw error
            toast.success('If that email exists, a reset link has been sent.')
        } catch (error: unknown) {
            console.error('Reset request error:', error)
            // Single error channel: inline alert (no duplicate toast).
            setFormError(
                error instanceof Error ? error.message : 'Failed to request reset',
            )
        } finally {
            setIsSending(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center">
                    <Logo size="lg" showText={true} vertical={true} />
                </div>

                <Card className="border-border/50 shadow-xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl">Reset your password</CardTitle>
                        <CardDescription>
                            Enter your email and we will send a reset link if it exists.
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
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    autoFocus
                                />
                            </div>
                            {formError && (
                                <p
                                    role="alert"
                                    id="forgot-password-error"
                                    className="text-sm text-destructive"
                                >
                                    {formError}
                                </p>
                            )}
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isSending}
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    'Send reset link'
                                )}
                            </Button>
                        </form>
                        <div className="mt-6 text-center text-sm">
                            <Link to="/login" className="text-primary hover:underline">
                                Back to login
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
