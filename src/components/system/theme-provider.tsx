import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ReactNode } from "react"

interface ThemeProviderProps {
    children: ReactNode
    defaultTheme?: string
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
        >
            {children}
        </NextThemesProvider>
    )
}
