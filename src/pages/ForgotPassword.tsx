import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/ui/Logo'

export function ForgotPassword() {
    const { resetPassword } = useAuth()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { error } = await resetPassword(email)
            if (error) throw error
            toast.success('If that email exists, a reset link has been sent.')
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Failed to request reset')
        } finally {
            setLoading(false)
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
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Sending...' : 'Send reset link'}
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
