import { useLocation, Link } from 'react-router-dom'
import {
    LayoutDashboard,
    Calendar,
    ArrowLeftRight,
    PiggyBank,
    Tags,
    Wallet,
    Target,
    Settings,
    LogOut,
} from 'lucide-react'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

const navItems = [
    { title: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { title: 'Transactions', icon: ArrowLeftRight, path: '/transactions' },
    { title: 'Calendar', icon: Calendar, path: '/calendar' },
    { title: 'Budgets', icon: PiggyBank, path: '/budgets' },
    { title: 'Goals', icon: Target, path: '/goals' },
    { title: 'Accounts', icon: Wallet, path: '/accounts' },
    { title: 'Categories', icon: Tags, path: '/categories' },
]

const bottomNavItems = [
    { title: 'Settings', icon: Settings, path: '/settings' },
]

export function AppSidebar() {
    const location = useLocation()
    const { user, signOut } = useAuth()

    const getInitials = (name: string | undefined) => {
        if (!name) return 'U'
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    return (
        <Sidebar className="border-r border-border/50">
            <SidebarHeader className="border-b border-border/50 p-4">
                <div className="flex items-center gap-3 px-2">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 dark:bg-slate-950 shadow-lg dark:shadow-2xl overflow-hidden group/logo border border-primary/20 dark:border-white/10">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 dark:from-slate-900 dark:via-slate-950 dark:to-black" />
                        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 relative z-10 transition-all duration-500 group-hover/logo:scale-110">
                            {/* Growth Bars */}
                            <rect x="4" y="14" width="3" height="6" rx="1" fill="currentColor" className="text-emerald-500/40 dark:text-emerald-500/30" />
                            <rect x="10.5" y="10" width="3" height="10" rx="1" fill="currentColor" className="text-emerald-500/70 dark:text-emerald-500/60" />
                            <rect x="17" y="4" width="3" height="16" rx="1" fill="currentColor" className="text-emerald-500 dark:text-emerald-400" />
                            {/* Trend Line */}
                            <path d="M4 14L10.5 10L17 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary dark:text-white opacity-40 group-hover/logo:opacity-100 transition-opacity" />
                        </svg>
                        <div className="absolute -inset-1 bg-emerald-500/10 blur-xl opacity-0 group-hover/logo:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-black tracking-[0.25em] text-foreground uppercase opacity-90">
                            Personal Finance
                        </span>
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mt-0.5 opacity-80">
                            Tracker
                        </span>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={location.pathname === item.path}
                                    >
                                        <Link to={item.path}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup className="mt-auto">
                    <SidebarGroupLabel>Settings</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {bottomNavItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={location.pathname === item.path}
                                    >
                                        <Link to={item.path}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-border/50 p-4">
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={user?.user_metadata?.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(user?.user_metadata?.full_name || user?.email)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 flex-col overflow-hidden">
                        <span className="truncate text-sm font-medium">
                            {user?.user_metadata?.full_name || 'User'}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            {user?.email}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={signOut}
                        className="h-8 w-8 shrink-0"
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
