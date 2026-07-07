import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ReactNode } from "react"
import { COLOR_THEMES, type ThemeName } from "./themes"

interface ThemeProviderProps {
    children: ReactNode
    defaultTheme?: ThemeName
    storageKey?: string
    enableSystem?: boolean
    disableTransitionOnChange?: boolean
}

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "financetrack-theme",
    enableSystem = true,
    disableTransitionOnChange = false,
}: ThemeProviderProps) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme={defaultTheme}
            storageKey={storageKey}
            enableSystem={enableSystem}
            disableTransitionOnChange={disableTransitionOnChange}
            themes={[...COLOR_THEMES]}
        >
            {children}
        </NextThemesProvider>
    )
}
