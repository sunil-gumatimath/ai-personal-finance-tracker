import { ThemeProvider as NextThemesProvider } from "next-themes"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { type AccentName, type ThemeName } from "./themes"

const ACCENT_STORAGE_KEY = "financetrack-accent"

interface ThemeProviderProps {
    children: ReactNode
    defaultTheme?: ThemeName
    storageKey?: string
    enableSystem?: boolean
    disableTransitionOnChange?: boolean
}

interface AccentContextValue {
    accent: AccentName
    setAccent: (accent: AccentName) => void
}

const AccentContext = createContext<AccentContextValue | null>(null)

function readStoredAccent(): AccentName {
    try {
        return window.localStorage.getItem(ACCENT_STORAGE_KEY) === "emerald" ? "emerald" : "default"
    } catch {
        return "default"
    }
}

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "financetrack-theme",
    enableSystem = true,
    disableTransitionOnChange = false,
}: ThemeProviderProps) {
    // Read synchronously so the accent class is correct on first render (matches the
    // blocking script in index.html, avoiding a flash of the default accent).
    const [accent, setAccent] = useState<AccentName>(readStoredAccent)

    useEffect(() => {
        document.documentElement.classList.toggle("theme-emerald", accent === "emerald")
        try {
            window.localStorage.setItem(ACCENT_STORAGE_KEY, accent)
        } catch {
            // Persistence is best-effort (private mode, quota errors, etc.)
        }
    }, [accent])

    const accentValue = useMemo(() => ({ accent, setAccent }), [accent])

    return (
        <NextThemesProvider
            attribute="class"
            themes={["light", "dark", "system"]}
            defaultTheme={defaultTheme}
            storageKey={storageKey}
            enableSystem={enableSystem}
            disableTransitionOnChange={disableTransitionOnChange}
        >
            <AccentContext.Provider value={accentValue}>
                {children}
            </AccentContext.Provider>
        </NextThemesProvider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook export alongside provider is intentional
export function useAccent(): AccentContextValue {
    const context = useContext(AccentContext)
    if (!context) {
        throw new Error("useAccent must be used within a ThemeProvider.")
    }
    return context
}
