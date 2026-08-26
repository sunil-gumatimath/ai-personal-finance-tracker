import { useLocation, useNavigate, Link } from 'react-router-dom'
import { ChevronRight, LogOut, Settings, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/system/theme-toggle'
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
import { ROUTE_TITLES } from '@/pages'
import { getInitials } from '@/lib/initials'

export function Header() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, signOut } = useAuth()

    // Canonical short label shared with the sidebar and document title
    const pageTitle = ROUTE_TITLES[location.pathname] ?? 'Dashboard'

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b border-border/50 bg-background/95 px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger
                aria-label="Toggle sidebar"
                className="-ml-1 relative size-7 after:absolute after:-inset-2 after:content-[''] active:scale-95 transition-transform"
            />
            <Separator orientation="vertical" className="h-6" />

            {/* Breadcrumbs - Hidden on mobile, simplified on tablet */}
            <div className="flex flex-1 items-center">
                {/* Mobile: Show current page title only */}
                <span
                    aria-current="page"
                    className="font-semibold text-foreground sm:hidden"
                >
                    {pageTitle}
                </span>
                {/* Tablet/Desktop: Show full breadcrumbs */}
                <nav
                    aria-label="Breadcrumb"
                    className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground"
                >
                    {location.pathname !== '/' ? (
                        <>
                            <Link
                                to="/"
                                className="rounded-sm hover:text-foreground transition-colors"
                            >
                                Home
                            </Link>
                            <ChevronRight
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0"
                            />
                            <span
                                aria-current="page"
                                className="font-medium text-foreground"
                            >
                                {pageTitle}
                            </span>
                        </>
                    ) : (
                        <span
                            aria-current="page"
                            className="font-medium text-foreground"
                        >
                            Dashboard
                        </span>
                    )}
                </nav>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* User Profile Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="relative size-9 rounded-full after:absolute after:-inset-2 after:content-[''] active:scale-95 transition-transform"
                            aria-label="Open user menu"
                        >
                            <Avatar className="size-9">
                                <AvatarImage
                                    src={user?.user_metadata?.avatar_url || undefined}
                                    alt={user?.user_metadata?.full_name || 'User avatar'}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                    {getInitials(
                                        user?.user_metadata?.full_name || user?.email,
                                    )}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end">
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
                        <DropdownMenuItem asChild>
                            <Link to="/settings">
                                <UserRound className="mr-2 h-4 w-4" />
                                <span>Profile</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link to="/settings">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </Link>
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
