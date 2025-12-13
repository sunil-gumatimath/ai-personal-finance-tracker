import { Moon, Sun, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { useEffect, useState } from 'react'

export function Header() {
    const [isDark, setIsDark] = useState(true)

    useEffect(() => {
        // Check for saved theme preference or default to dark
        const savedTheme = localStorage.getItem('theme')
        if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark')
            setIsDark(false)
        } else {
            document.documentElement.classList.add('dark')
            setIsDark(true)
        }
    }, [])

    const toggleTheme = () => {
        if (isDark) {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
            setIsDark(false)
        } else {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
            setIsDark(true)
        }
    }

    return (
        <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b border-border/50 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-6" />

            <div className="flex flex-1 items-center gap-4">
                <h1 className="text-lg font-semibold md:text-xl">Personal Finance Tracker</h1>
            </div>

            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleTheme}>
                    {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
            </div>
        </header>
    )
}
