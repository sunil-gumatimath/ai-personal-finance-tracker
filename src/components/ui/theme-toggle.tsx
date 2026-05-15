import { Moon, Sun, Monitor, Waves, Trees, Sunset } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"

type ThemeVariant = "default" | "ocean" | "forest" | "sunset"

const THEME_STORAGE_KEY = "financetrack-theme-variant"

function applyThemeVariant(variant: ThemeVariant) {
    const root = document.documentElement
    root.classList.remove("ocean", "forest", "sunset")
    if (variant !== "default") {
        root.classList.add(variant)
    }
}

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()
    const [variant, setVariant] = useState<ThemeVariant>("default")

    useEffect(() => {
        const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeVariant | null
        if (saved) {
            setVariant(saved)
            applyThemeVariant(saved)
        }
    }, [])

    const handleVariantChange = (newVariant: ThemeVariant) => {
        setVariant(newVariant)
        localStorage.setItem(THEME_STORAGE_KEY, newVariant)
        applyThemeVariant(newVariant)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
                    <Sun className="h-4 w-4" />
                    Light
                    {theme === "light" && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
                    <Moon className="h-4 w-4" />
                    Dark
                    {theme === "dark" && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2">
                    <Monitor className="h-4 w-4" />
                    System
                    {theme === "system" && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Color Theme</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => handleVariantChange("default")} className="gap-2">
                            <span className="h-2 w-2 rounded-full bg-neutral-500" />
                            Default
                            {variant === "default" && <span className="ml-auto text-xs">✓</span>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleVariantChange("ocean")} className="gap-2">
                            <Waves className="h-4 w-4 text-blue-500" />
                            Ocean
                            {variant === "ocean" && <span className="ml-auto text-xs">✓</span>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleVariantChange("forest")} className="gap-2">
                            <Trees className="h-4 w-4 text-green-500" />
                            Forest
                            {variant === "forest" && <span className="ml-auto text-xs">✓</span>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleVariantChange("sunset")} className="gap-2">
                            <Sunset className="h-4 w-4 text-amber-500" />
                            Sunset
                            {variant === "sunset" && <span className="ml-auto text-xs">✓</span>}
                        </DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
