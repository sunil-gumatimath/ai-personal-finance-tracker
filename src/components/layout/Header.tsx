import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Bell, ChevronRight, LogOut, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'

// Route configuration for dynamic titles and breadcrumbs
const routeConfig: Record<string, { title: string; breadcrumb: string }> = {
    '/': { title: 'Dashboard', breadcrumb: 'Dashboard' },
    '/transactions': { title: 'Transactions', breadcrumb: 'Transactions' },
    '/calendar': { title: 'Calendar', breadcrumb: 'Calendar' },
    '/budgets': { title: 'Budgets', breadcrumb: 'Budgets' },
    '/goals': { title: 'Savings Goals', breadcrumb: 'Goals' },
    '/categories': { title: 'Categories', breadcrumb: 'Categories' },
    '/accounts': { title: 'Accounts', breadcrumb: 'Accounts' },
    '/settings': { title: 'Settings', breadcrumb: 'Settings' },
}

export function Header() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, signOut } = useAuth()

    // Get current route config
    const currentRoute = routeConfig[location.pathname] || { title: 'Dashboard', breadcrumb: 'Dashboard' }

    // Get user initials for avatar fallback
    const getUserInitials = () => {
        const fullName = user?.user_metadata?.full_name || user?.email || 'User'
        const parts = fullName.split(' ')
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        }
        return fullName.substring(0, 2).toUpperCase()
    }

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b border-border/50 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-6" />

            {/* Breadcrumbs - Hidden on mobile, simplified on tablet */}
            <div className="flex flex-1 items-center">
                {/* Mobile: Show current page title only */}
                <span className="font-semibold text-foreground sm:hidden">
                    {currentRoute.breadcrumb}
                </span>
                {/* Tablet/Desktop: Show full breadcrumbs */}
                <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
                    <Link
                        to="/"
                        className="hover:text-foreground transition-colors"
                    >
                        Home
                    </Link>
                    {location.pathname !== '/' && (
                        <>
                            <ChevronRight className="h-4 w-4" />
                            <span className="text-foreground font-medium">
                                {currentRoute.breadcrumb}
                            </span>
                        </>
                    )}
                </nav>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {/* Notifications */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label="Notifications"
                >
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Notifications</span>
                </Button>

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* User Profile Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="relative h-9 w-9 rounded-full"
                            aria-label="Open user menu"
                        >
                            <Avatar className="h-9 w-9">
                                <AvatarImage
                                    src={user?.user_metadata?.avatar_url || undefined}
                                    alt={user?.user_metadata?.full_name || 'User avatar'}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                    {getUserInitials()}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">
                                    {user?.user_metadata?.full_name || 'User'}
                                </p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user?.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate('/settings')}>
                            <User className="mr-2 h-4 w-4" />
                            <span>Profile</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/settings')}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={handleSignOut}
                            variant="destructive"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}

