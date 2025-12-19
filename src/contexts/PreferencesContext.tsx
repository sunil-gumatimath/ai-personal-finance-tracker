import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import {
    type Preferences,
    PREFERENCES_KEY,
    defaultPreferences,
    currencySymbols,
    currencyLocales
} from '@/types/preferences'

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
            const preferences = { ...defaultPreferences, ...parsed }

            // Migration: Update old Gemini 3 model strings to correct preview strings
            if (preferences.geminiModel === 'gemini-3-flash') {
                preferences.geminiModel = 'gemini-3-flash-preview'
            } else if (preferences.geminiModel === 'gemini-3-pro') {
                preferences.geminiModel = 'gemini-3-pro-preview'
            }

            return preferences
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

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
    const context = useContext(PreferencesContext)
    if (context === undefined) {
        throw new Error('usePreferences must be used within a PreferencesProvider')
    }
    return context
}
