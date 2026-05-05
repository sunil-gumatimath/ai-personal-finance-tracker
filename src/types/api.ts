/**
 * API Response types — strongly typed interfaces for every API endpoint.
 * Uses existing database types from ./database.ts where possible.
 */

import type {
    Account,
    Transaction,
    Category,
    Budget,
    Goal,
    Debt,
    DebtPayment,
    Profile,
} from './database'

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
    id: string
    email?: string
    user_metadata: {
        full_name?: string
        avatar_url?: string | null
    }
    app_metadata: Record<string, unknown>
    aud: string
    created_at: string
}

export interface AuthResponse {
    user: AuthUser
}

export interface LogoutResponse {
    ok: boolean
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface UserPreferences {
    currency?: string
    dateFormat?: string
    notifications?: boolean
    emailAlerts?: boolean
    budgetAlerts?: boolean
    geminiApiKey?: string
    geminiModel?: string
}

export interface ProfileResponse {
    preferences: UserPreferences | null
    currency: string | null
}

export interface ProfileUpdateResponse {
    ok: boolean
    preferences: UserPreferences | null
    currency: string | null
}

export interface ProfileUpdatePayload {
    preferences?: UserPreferences
    currency?: string
    full_name?: string
    avatar_url?: string | null
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export interface AccountsListResponse {
    accounts: Account[]
}

export interface AccountResponse {
    account: Account
}

export interface AccountCreatePayload {
    name: string
    type: Account['type']
    balance?: number
    currency?: string
    color?: string
    icon?: string
}

export type AccountUpdatePayload = Partial<AccountCreatePayload>

export interface LinkedCountResponse {
    count: number
}

// ─── Categories ──────────────────────────────────────────────────────────────

export interface CategoriesListResponse {
    categories: Category[]
}

export interface CategoryResponse {
    category: Category
}

export interface CategoryPayload {
    name: string
    type: Category['type']
    color?: string
    icon?: string
    parent_id?: string | null
}

// ─── Transactions ────────────────────────────────────────────────────────────

export interface TransactionsListResponse {
    transactions: Transaction[]
}

export interface TransactionResponse {
    transaction: Transaction
}

export interface TransactionCreatePayload {
    account_id: string
    category_id?: string | null
    to_account_id?: string | null
    type: Transaction['type']
    amount: number
    description?: string | null
    notes?: string | null
    date: string
    is_recurring?: boolean
    recurring_frequency?: Transaction['recurring_frequency']
}

export type TransactionUpdatePayload = Partial<TransactionCreatePayload>

// ─── Budgets ─────────────────────────────────────────────────────────────────

export interface BudgetsListResponse {
    budgets: Budget[]
}

export interface BudgetResponse {
    budget: Budget
}

export interface BudgetPayload {
    category_id: string
    amount: number
    period: Budget['period']
    start_date: string
    end_date?: string | null
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export interface GoalsListResponse {
    goals: Goal[]
}

export interface GoalResponse {
    goal: Goal
}

export interface GoalPayload {
    name: string
    target_amount: number
    current_amount?: number
    deadline?: string | null
    color?: string
    icon?: string
}

// ─── Debts ───────────────────────────────────────────────────────────────────

export interface DebtsListResponse {
    debts: Debt[]
}

export interface DebtResponse {
    debt: Debt
}

export interface DebtPayload {
    name: string
    type: Debt['type']
    original_amount: number
    current_balance: number
    interest_rate: number
    minimum_payment: number
    due_day?: number | null
    start_date: string
    end_date?: string | null
    lender?: string | null
    notes?: string | null
    color?: string
    icon?: string
    is_active?: boolean
}

export interface DebtPaymentsListResponse {
    payments: DebtPayment[]
}

export interface DebtPaymentResponse {
    payment: DebtPayment
}

export interface DebtPaymentPayload {
    debt_id: string
    amount: number
    principal_amount?: number
    interest_amount?: number
    payment_date: string
    notes?: string | null
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface AiInsight {
    id: string
    user_id: string
    type: string
    title: string
    description: string
    severity: 'low' | 'medium' | 'high'
    is_dismissed: boolean
    created_at: string
}

export interface AiInsightsResponse {
    insights: AiInsight[]
}

export interface AiChatResponse {
    response: string
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface BudgetAlert {
    id: string
    type: 'budget'
    category: string
    color: string
    spent: number
    limit: number
    percentage: number
    status: 'ok' | 'warning' | 'over'
    message: string | null
}

export interface NotificationData {
    preferences: {
        notifications: boolean
        emailAlerts: boolean
        budgetAlerts: boolean
    }
    budgetAlerts: BudgetAlert[]
    recentActivity: Record<string, unknown>[]
    unreadCount: number
}

export interface NotificationActionResponse {
    success: boolean
    message: string
}

// ─── Generic ─────────────────────────────────────────────────────────────────

export interface OkResponse {
    ok: boolean
}

// Re-export database types for convenience
export type { Account, Transaction, Category, Budget, Goal, Debt, DebtPayment, Profile }
