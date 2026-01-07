import { useState } from 'react'
import { User, Bell, Shield, Palette, LogOut, Moon, Sun, Monitor, Brain, ChevronRight, Globe, Sparkles, Key, Layout } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { usePreferences } from '@/hooks/usePreferences'

import { cn } from '@/lib/utils'

function ThemeSelector() {
    const { theme, setTheme } = useTheme()

    const themes = [
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'dark', label: 'Dark', icon: Moon },
        { value: 'system', label: 'System', icon: Monitor },
    ]

    return (
        <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={cn(
                        'flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all hover:bg-muted/50',
                        theme === value
                            ? 'border-primary bg-primary/5'
                            : 'border-border/50'
                    )}
                >
                    <Icon className={cn('h-4 w-4', theme === value ? 'text-primary' : 'text-muted-foreground')} />
                    <span className={cn('text-xs', theme === value ? 'text-primary font-medium' : 'text-muted-foreground')}>
                        {label}
                    </span>
                </button>
            ))}
        </div>
    )
}

export function Settings() {
    const { user, signOut, updateProfile, resetPassword } = useAuth()
    const { preferences, savePreferences } = usePreferences()
    const [loading, setLoading] = useState(false)
    const [profileData, setProfileData] = useState({
        fullName: user?.user_metadata?.full_name || '',
        email: user?.email || '',
    })

    const handleProfileUpdate = async () => {
        setLoading(true)
        try {
            const { error } = await updateProfile({
                full_name: profileData.fullName,
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
            const { error } = await resetPassword(user.email)
            if (error) throw error
            toast.success('Password reset email sent')
        } catch (error) {
            console.error('Error sending reset email:', error)
            toast.error('Failed to send password reset email')
        }
    }

    return (
        <div className="max-w-3xl space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground">
                    Manage your account and preferences
                </p>
            </div>

            <Tabs defaultValue="profile" className="space-y-4">
                <TabsList className="h-9 rounded-lg bg-muted/50 p-1">
                    <TabsTrigger value="profile" className="rounded-md px-3 py-1.5 text-xs font-medium gap-1.5">
                        <User className="h-3.5 w-3.5" /> Profile
                    </TabsTrigger>
                    <TabsTrigger value="preferences" className="rounded-md px-3 py-1.5 text-xs font-medium gap-1.5">
                        <Palette className="h-3.5 w-3.5" /> Preferences
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="rounded-md px-3 py-1.5 text-xs font-medium gap-1.5">
                        <Bell className="h-3.5 w-3.5" /> Alerts
                    </TabsTrigger>
                    <TabsTrigger value="security" className="rounded-md px-3 py-1.5 text-xs font-medium gap-1.5">
                        <Shield className="h-3.5 w-3.5" /> Security
                    </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-4">
                    <div className="rounded-lg border border-border/50 bg-card/50">
                        <div className="px-4 py-3 border-b border-border/50">
                            <h3 className="text-sm font-medium">Account Details</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="fullName" className="text-xs">Full Name</Label>
                                    <Input
                                        id="fullName"
                                        value={profileData.fullName}
                                        onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                                        className="h-9 text-sm"
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="email" className="text-xs">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={profileData.email}
                                        disabled
                                        className="h-9 text-sm bg-muted/30"
                                    />
                                </div>
                            </div>
                            <Button onClick={handleProfileUpdate} disabled={loading} size="sm" className="h-8">
                                {loading ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                {/* Preferences Tab */}
                <TabsContent value="preferences" className="space-y-4">
                    {/* Interface */}
                    <div className="rounded-lg border border-border/50 bg-card/50">
                        <div className="px-4 py-3 border-b border-border/50">
                            <h3 className="text-sm font-medium">Interface</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Theme</Label>
                                <ThemeSelector />
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Currency</Label>
                                    <Select value={preferences.currency} onValueChange={(v) => savePreferences({ currency: v })}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <Globe className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
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
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Date Format</Label>
                                    <Select value={preferences.dateFormat} onValueChange={(v) => savePreferences({ dateFormat: v })}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                                            <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                                            <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Integration */}
                    <div className="rounded-lg border border-primary/20 bg-primary/[0.02]">
                        <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                            <Brain className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-medium">AI Integration</h3>
                        </div>
                        <div className="p-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="geminiApiKey" className="text-xs flex items-center gap-1.5">
                                        <Key className="h-3 w-3" /> API Key
                                    </Label>
                                    <Input
                                        id="geminiApiKey"
                                        type="password"
                                        placeholder="Enter your Gemini API key"
                                        value={preferences.geminiApiKey}
                                        onChange={(e) => savePreferences({ geminiApiKey: e.target.value })}
                                        className="h-9 text-sm font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs flex items-center gap-1.5">
                                        <Layout className="h-3 w-3" /> Model
                                    </Label>
                                    <div className="h-9 flex items-center px-3 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground">
                                        <Sparkles className="mr-2 h-3.5 w-3.5 text-primary" />
                                        Gemini 3 Flash (Latest)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="space-y-4">
                    <div className="rounded-lg border border-border/50 bg-card/50">
                        <div className="px-4 py-3 border-b border-border/50">
                            <h3 className="text-sm font-medium">Notification Preferences</h3>
                        </div>
                        <div>
                            {[
                                { id: 'notifications', label: 'Push Notifications', desc: 'Real-time alerts for important events' },
                                { id: 'emailAlerts', label: 'Email Summaries', desc: 'Weekly digest emails' },
                                { id: 'budgetAlerts', label: 'Budget Alerts', desc: 'Alerts when spending exceeds limits' }
                            ].map((item, i, arr) => (
                                <div key={item.id} className={cn(
                                    "flex items-center justify-between px-4 py-3",
                                    i !== arr.length - 1 && "border-b border-border/30"
                                )}>
                                    <div className="space-y-0.5">
                                        <Label className="text-sm cursor-pointer" onClick={() => savePreferences({ [item.id]: !preferences[item.id as keyof typeof preferences] })}>
                                            {item.label}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                                    </div>
                                    <Switch
                                        checked={preferences[item.id as keyof typeof preferences] as boolean}
                                        onCheckedChange={(checked) => savePreferences({ [item.id]: checked })}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="space-y-4">
                    <div className="rounded-lg border border-border/50 bg-card/50">
                        <div className="px-4 py-3 border-b border-border/50">
                            <h3 className="text-sm font-medium">Password</h3>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium">Reset Password</p>
                                    <p className="text-xs text-muted-foreground">Send a reset link to your email</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={handlePasswordReset} className="h-8">
                                    Send Link <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-destructive/20 bg-destructive/[0.02]">
                        <div className="px-4 py-3 border-b border-destructive/10">
                            <h3 className="text-xs font-medium text-destructive uppercase tracking-wide">Danger Zone</h3>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium">Sign Out</p>
                                    <p className="text-xs text-muted-foreground">End your current session</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={signOut} className="h-8 border-destructive/30 text-destructive hover:bg-destructive hover:text-white">
                                    <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign Out
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
