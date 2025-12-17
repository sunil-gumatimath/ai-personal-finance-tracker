import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

const PREFERENCES_KEY = 'financetrack_preferences'

export interface Preferences {
    currency: string
    dateFormat: string
    notifications: boolean
    emailAlerts: boolean
    budgetAlerts: boolean
}

const defaultPreferences: Preferences = {
    currency: 'INR',
    dateFormat: 'MM/dd/yyyy',
    notifications: true,
    emailAlerts: true,
    budgetAlerts: true,
}

const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    JPY: '¥',
}

const currencyLocales: Record<string, string> = {
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    INR: 'en-IN',
    JPY: 'ja-JP',
}

interface PreferencesContextType {
    preferences: Preferences
    setPreferences: React.Dispatch<React.SetStateAction<Preferences>>
    savePreferences: (newPreferences: Partial<Preferences>) => void
    formatCurrency: (amount: number) => string
    getCurrencySymbol: () => string
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined)

const loadInitialPreferences = (): Preferences => {
    try {
        const saved = localStorage.getItem(PREFERENCES_KEY)
        if (saved) {
            const parsed = JSON.parse(saved)
            return { ...defaultPreferences, ...parsed }
        }
    } catch {
        // Failed to parse preferences, using defaults
    }
    return defaultPreferences
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
    const [preferences, setPreferences] = useState<Preferences>(loadInitialPreferences)

    // Sync preferences across tabs
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === PREFERENCES_KEY && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue)
                    setPreferences({ ...defaultPreferences, ...parsed })
                } catch {
                    // Ignore parse errors
                }
            }
        }
        window.addEventListener('storage', handleStorageChange)
        return () => window.removeEventListener('storage', handleStorageChange)
    }, [])

    // Save preferences to localStorage
    const savePreferences = useCallback((newPreferences: Partial<Preferences>) => {
        setPreferences(prev => {
            const updated = { ...prev, ...newPreferences }
            localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated))
            return updated
        })
    }, [])

    // Format currency based on user preference
    const formatCurrency = useCallback((amount: number) => {
        const locale = currencyLocales[preferences.currency] || 'en-US'
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: preferences.currency,
        }).format(amount)
    }, [preferences.currency])

    // Get currency symbol
    const getCurrencySymbol = useCallback(() => {
        return currencySymbols[preferences.currency] || '$'
    }, [preferences.currency])

    return (
        <PreferencesContext.Provider value={{
            preferences,
            setPreferences,
            savePreferences,
            formatCurrency,
            getCurrencySymbol,
        }}>
            {children}
        </PreferencesContext.Provider>
    )
}

export function usePreferences() {
    const context = useContext(PreferencesContext)
    if (context === undefined) {
        throw new Error('usePreferences must be used within a PreferencesProvider')
    }
    return context
}
