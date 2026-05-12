export interface Preferences {
    currency: string
    dateFormat: string
    notifications: boolean
    emailAlerts: boolean
    budgetAlerts: boolean
    aiProvider?: 'gemini' | 'openrouter'
    geminiApiKey?: string
    geminiModel?: string
    openrouterApiKey?: string
    openrouterModel?: string
}

export const PREFERENCES_KEY = 'financetrack_preferences'

export const defaultPreferences: Preferences = {
    currency: 'INR',
    dateFormat: 'MM/dd/yyyy',
    notifications: true,
    emailAlerts: true,
    budgetAlerts: true,
    aiProvider: 'gemini',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-pro',
    openrouterApiKey: '',
    openrouterModel: 'openrouter/free',
}

export const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    JPY: '¥',
}

export const currencyLocales: Record<string, string> = {
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    INR: 'en-IN',
    JPY: 'ja-JP',
}
