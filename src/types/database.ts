// Database types for Supabase

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Profile
                Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Profile, 'id'>>
            }
            accounts: {
                Row: Account
                Insert: Omit<Account, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Account, 'id'>>
            }
            categories: {
                Row: Category
                Insert: Omit<Category, 'id' | 'created_at'>
                Update: Partial<Omit<Category, 'id'>>
            }
            transactions: {
                Row: Transaction
                Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Transaction, 'id'>>
            }
            budgets: {
                Row: Budget
                Insert: Omit<Budget, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Budget, 'id'>>
            }
        }
    }
}

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
