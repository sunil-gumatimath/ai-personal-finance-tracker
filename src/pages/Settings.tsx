import { useState } from 'react'
import { User, Bell, Shield, Palette, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function Settings() {
    const { user, signOut } = useAuth()
    const [loading, setLoading] = useState(false)
    const [profileData, setProfileData] = useState({
        fullName: user?.user_metadata?.full_name || '',
        email: user?.email || '',
    })
    const [preferences, setPreferences] = useState({
        currency: 'USD',
        dateFormat: 'MM/dd/yyyy',
        notifications: true,
        emailAlerts: true,
        budgetAlerts: true,
    })

    const handleProfileUpdate = async () => {
        setLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({
                data: { full_name: profileData.fullName },
            })

            if (error) throw error
            toast.success('Profile updated successfully')
        } catch (error) {
            console.error('Error updating profile:', error)
            toast.error('Failed to update profile')
        } finally {
            setLoading(false)
        }
    }

    const handlePasswordReset = async () => {
        if (!user?.email) return

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email)
            if (error) throw error
            toast.success('Password reset email sent')
        } catch (error) {
            console.error('Error sending reset email:', error)
            toast.error('Failed to send password reset email')
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account settings and preferences
                </p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="profile" className="gap-2">
                        <User className="h-4 w-4" />
                        Profile
                    </TabsTrigger>
                    <TabsTrigger value="preferences" className="gap-2">
                        <Palette className="h-4 w-4" />
                        Preferences
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="gap-2">
                        <Bell className="h-4 w-4" />
                        Notifications
                    </TabsTrigger>
                    <TabsTrigger value="security" className="gap-2">
                        <Shield className="h-4 w-4" />
                        Security
                    </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Information</CardTitle>
                            <CardDescription>
                                Update your personal information
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input
                                    id="fullName"
                                    value={profileData.fullName}
                                    onChange={(e) =>
                                        setProfileData({ ...profileData, fullName: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={profileData.email}
                                    disabled
                                    className="bg-muted"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Email cannot be changed
                                </p>
                            </div>
                            <Button onClick={handleProfileUpdate} disabled={loading}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Preferences Tab */}
                <TabsContent value="preferences" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Display Preferences</CardTitle>
                            <CardDescription>
                                Customize how information is displayed
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Currency</Label>
                                <Select
                                    value={preferences.currency}
                                    onValueChange={(value) =>
                                        setPreferences({ ...preferences, currency: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                        <SelectItem value="GBP">GBP (£)</SelectItem>
                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Date Format</Label>
                                <Select
                                    value={preferences.dateFormat}
                                    onValueChange={(value) =>
                                        setPreferences({ ...preferences, dateFormat: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                                        <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                                        <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button>Save Preferences</Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Notification Settings</CardTitle>
                            <CardDescription>
                                Configure how you receive notifications
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Push Notifications</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Receive notifications in your browser
                                    </p>
                                </div>
                                <Switch
                                    checked={preferences.notifications}
                                    onCheckedChange={(checked) =>
                                        setPreferences({ ...preferences, notifications: checked })
                                    }
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Email Alerts</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Receive weekly summary emails
                                    </p>
                                </div>
                                <Switch
                                    checked={preferences.emailAlerts}
                                    onCheckedChange={(checked) =>
                                        setPreferences({ ...preferences, emailAlerts: checked })
                                    }
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Budget Alerts</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Get notified when you exceed budgets
                                    </p>
                                </div>
                                <Switch
                                    checked={preferences.budgetAlerts}
                                    onCheckedChange={(checked) =>
                                        setPreferences({ ...preferences, budgetAlerts: checked })
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Password</CardTitle>
                            <CardDescription>
                                Update your password to keep your account secure
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" onClick={handlePasswordReset}>
                                Send Password Reset Email
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-destructive/50">
                        <CardHeader>
                            <CardTitle className="text-destructive">Danger Zone</CardTitle>
                            <CardDescription>
                                Irreversible account actions
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Sign Out</p>
                                    <p className="text-sm text-muted-foreground">
                                        Sign out of your account on this device
                                    </p>
                                </div>
                                <Button variant="outline" onClick={signOut}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Sign Out
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
