import { useLocation, Link } from 'react-router-dom'
import {
    LayoutDashboard,
    ArrowLeftRight,
    PiggyBank,
    Tags,
    Wallet,
    Settings,
    LogOut,
    TrendingUp,
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
    { title: 'Budgets', icon: PiggyBank, path: '/budgets' },
    { title: 'Categories', icon: Tags, path: '/categories' },
    { title: 'Accounts', icon: Wallet, path: '/accounts' },
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
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-semibold tracking-tight">FinanceTrack</span>
                        <span className="text-xs text-muted-foreground">Personal Finance</span>
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
