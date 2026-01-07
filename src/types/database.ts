// Database types for Neon

export interface Profile {
    id: string
    user_id: string
    full_name: string | null
    avatar_url: string | null
    currency: string
    created_at: string
    updated_at: string
}

export interface Account {
    id: string
    user_id: string
    name: string
    type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'other'
    balance: number
    currency: string
    color: string
    icon: string
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface Category {
    id: string
    user_id: string
    name: string
    type: 'income' | 'expense'
    color: string
    icon: string
    parent_id: string | null
    created_at: string
}

export interface Transaction {
    id: string
    user_id: string
    account_id: string
    category_id: string | null
    to_account_id: string | null // For transfer transactions
    type: 'income' | 'expense' | 'transfer'
    amount: number
    description: string | null
    notes: string | null
    date: string
    is_recurring: boolean
    recurring_frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
    created_at: string
    updated_at: string
    // Joined fields
    account?: Account
    category?: Category
    to_account?: Account // For transfer transactions
}

export interface Budget {
    id: string
    user_id: string
    category_id: string
    amount: number
    period: 'weekly' | 'monthly' | 'yearly'
    start_date: string
    end_date: string | null
    created_at: string
    updated_at: string
    // Joined fields
    category?: Category
    spent?: number
}

export interface Goal {
    id: string
    user_id: string
    name: string
    target_amount: number
    current_amount: number
    deadline: string | null
    color: string
    icon: string
    created_at: string
    updated_at: string
}

// Stats types
export interface DashboardStats {
    totalBalance: number
    monthlyIncome: number
    monthlyExpenses: number
    monthlyNet: number
    savingsRate: number
}

export interface SpendingByCategory {
    category: string
    amount: number
    color: string
    percentage: number
}

export interface MonthlyTrend {
    month: string
    income: number
    expenses: number
}
