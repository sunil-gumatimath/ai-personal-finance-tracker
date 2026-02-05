import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    StatCard,
    RecentTransactions,
    SpendingChart,
    BudgetOverview,
    AICoach,
    FinancialHealthScore
} from '@/components/dashboard'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import type { Transaction, DashboardStats, SpendingByCategory, MonthlyTrend, Category } from '@/types'
import { Link } from 'react-router-dom'
import { useAIInsights, type Insight } from '@/hooks/useAIInsights'
import { useFinancialHealth } from '@/hooks/useFinancialHealth'

// Extended stats to include last month for comparisons
interface ExtendedDashboardStats extends DashboardStats {
    lastMonthIncome: number
    lastMonthExpenses: number
    incomeChange: number
    expensesChange: number
}

export function Dashboard() {
    const { user } = useAuth()
    const { formatCurrency } = usePreferences()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<ExtendedDashboardStats>({
        totalBalance: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        monthlyNet: 0,
        savingsRate: 0,
        lastMonthIncome: 0,
        lastMonthExpenses: 0,
        incomeChange: 0,
        expensesChange: 0,
    })
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
    const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([])
    const [spendingByCategory, setSpendingByCategory] = useState<SpendingByCategory[]>([])

    const { data: healthData, loading: healthLoading } = useFinancialHealth()
    useEffect(() => {
        async function fetchDashboardData() {
            if (!user) {
                setLoading(false)
                return
            }

            try {
                // PostgreSQL DECIMAL may come back as a string; normalize before doing math
                const toNumber = (val: unknown): number => {
                    if (typeof val === 'number') return isNaN(val) ? 0 : val
                    if (typeof val === 'string') {
                        const parsed = parseFloat(val)
                        return isNaN(parsed) ? 0 : parsed
                    }
                    return 0
                }

                // Helper to get local date string (YYYY-MM-DD) to avoid timezone issues
                const getLocalDateString = (date: Date): string => {
                    const year = date.getFullYear()
                    const month = String(date.getMonth() + 1).padStart(2, '0')
                    const day = String(date.getDate()).padStart(2, '0')
                    return `${year}-${month}-${day}`
                }

                const now = new Date()
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
                const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

                // Use local date strings to avoid timezone issues
                const startOfMonthStr = getLocalDateString(startOfMonth)
                const startOfLastMonthStr = getLocalDateString(startOfLastMonth)
                const sixMonthsAgoStr = getLocalDateString(sixMonthsAgo)

                const transactionsRes = await api.transactions.list({ since: sixMonthsAgoStr })
                const allTransactions = (transactionsRes.transactions || []) as Transaction[]
                setRecentTransactions(allTransactions.slice(0, 10))

                // 2. Fetch both current and last month data for comparison
                type TwoMonthRow = {
                    type: Transaction['type']
                    amount: unknown
                    date: string | Date
                    category: Category | null
                }

                const twoMonthData = allTransactions.filter(t => {
                    const dateVal = String(t.date).split('T')[0]
                    return dateVal >= startOfLastMonthStr
                }) as TwoMonthRow[]

                if (twoMonthData) {
                    // Helper to normalize date to YYYY-MM-DD (PostgreSQL may return Date objects or ISO strings)
                    const normalizeDate = (dateVal: string | Date): string => {
                        if (dateVal instanceof Date) {
                            const year = dateVal.getFullYear()
                            const month = String(dateVal.getMonth() + 1).padStart(2, '0')
                            const day = String(dateVal.getDate()).padStart(2, '0')
                            return `${year}-${month}-${day}`
                        }
                        // If it's a string, strip time portion if present
                        return String(dateVal).split('T')[0]
                    }

                    // Split into current and last month
                    const currentMonthData = twoMonthData.filter((t) => normalizeDate(t.date) >= startOfMonthStr)
                    const lastMonthData = twoMonthData.filter((t) => normalizeDate(t.date) >= startOfLastMonthStr && normalizeDate(t.date) < startOfMonthStr)

                    // Calculate current month stats
                    const income = currentMonthData
                        .filter((t) => t.type === 'income')
                        .reduce((sum, t) => sum + toNumber(t.amount), 0)
                    const expenses = currentMonthData
                        .filter((t) => t.type === 'expense')
                        .reduce((sum, t) => sum + toNumber(t.amount), 0)

                    const lastMonthIncome = lastMonthData
                        .filter((t) => t.type === 'income')
                        .reduce((sum, t) => sum + toNumber(t.amount), 0)
                    const lastMonthExpenses = lastMonthData
                        .filter((t) => t.type === 'expense')
                        .reduce((sum, t) => sum + toNumber(t.amount), 0)

                    // Calculate percentage changes
                    const incomeChange = lastMonthIncome > 0
                        ? ((income - lastMonthIncome) / lastMonthIncome) * 100
                        : (income > 0 ? 100 : 0)
                    const expensesChange = lastMonthExpenses > 0
                        ? ((expenses - lastMonthExpenses) / lastMonthExpenses) * 100
                        : (expenses > 0 ? 100 : 0)

                    setStats({
                        totalBalance: 0, // Will be updated by accounts fetch
                        monthlyIncome: income,
                        monthlyExpenses: expenses,
                        monthlyNet: income - expenses,
                        savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
                        lastMonthIncome,
                        lastMonthExpenses,
                        incomeChange,
                        expensesChange,
                    })

                    // Calculate Spending by Category
                    const categoryMap = new Map<string, { amount: number; color: string }>()
                    const totalExpenses = expenses || 1 // Avoid division by zero

                    currentMonthData
                        .filter((t) => t.type === 'expense' && t.category)
                        .forEach((t) => {
                            const category = t.category
                            const catName = category?.name || 'Uncategorized'
                            const catColor = category?.color || '#94a3b8'
                            const current = categoryMap.get(catName) || { amount: 0, color: catColor }
                            categoryMap.set(catName, {
                                amount: current.amount + toNumber(t.amount),
                                color: catColor
                            })
                        })

                    const spendingData: SpendingByCategory[] = Array.from(categoryMap.entries())
                        .map(([category, { amount, color }]) => ({
                            category,
                            amount,
                            color,
                            percentage: (amount / totalExpenses) * 100
                        }))
                        .sort((a, b) => b.amount - a.amount)

                    setSpendingByCategory(spendingData)
                }

                // 3. Fetch 6-month trend data
                const trendData = allTransactions
                    .filter(t => String(t.date).split('T')[0] >= sixMonthsAgoStr)
                    .map(t => ({ type: t.type, amount: t.amount as number, date: String(t.date) }))

                if (trendData) {
                    const monthsMap = new Map<string, { income: number; expenses: number }>()

                    // Initialize last 6 months
                    for (let i = 0; i < 6; i++) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                        const monthKey = d.toLocaleString('default', { month: 'short' })
                        monthsMap.set(monthKey, { income: 0, expenses: 0 })
                    }

                    trendData.forEach((t) => {
                        const d = new Date(t.date)
                        const monthKey = d.toLocaleString('default', { month: 'short' })
                        if (monthsMap.has(monthKey)) {
                            const current = monthsMap.get(monthKey)!
                            if (t.type === 'income') current.income += toNumber(t.amount)
                            if (t.type === 'expense') current.expenses += toNumber(t.amount)
                        }
                    })

                    // Convert map to array and reverse to show chronological order if needed
                    // (But we inserted keys in reverse order, so we might want to fix the order)
                    // Better approach: Generate array of keys in chronological order first
                    const orderedMonths: string[] = []
                    for (let i = 5; i >= 0; i--) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                        const orderedMonths_push = d.toLocaleString('default', { month: 'short' })
                        orderedMonths.push(orderedMonths_push)
                    }

                    const monthlyTrendData: MonthlyTrend[] = orderedMonths.map(month => ({
                        month,
                        income: monthsMap.get(month)?.income || 0,
                        expenses: monthsMap.get(month)?.expenses || 0
                    }))

                    setMonthlyTrends(monthlyTrendData)
                }

                // 4. Fetch accounts for total balance
                const accountsRes = await api.accounts.list()
                type AccountBalanceRow = { is_active: boolean; balance: number | string }
                const rawAccounts = Array.isArray(accountsRes.accounts) ? accountsRes.accounts : []
                const accounts = rawAccounts.filter((a): a is AccountBalanceRow => {
                    if (!a || typeof a !== 'object') return false
                    const candidate = a as { is_active?: unknown; balance?: unknown }
                    const hasValidActive = typeof candidate.is_active === 'boolean'
                    const hasValidBalance = typeof candidate.balance === 'number' || typeof candidate.balance === 'string'
                    return hasValidActive && hasValidBalance && candidate.is_active === true
                })
                const totalBalance = accounts.reduce((sum: number, a) => {
                    const balance = typeof a.balance === 'string' ? parseFloat(a.balance) : a.balance
                    return sum + (isNaN(balance) ? 0 : balance)
                }, 0)
                setStats((prev) => ({ ...prev, totalBalance }))
            } catch (error) {
                console.error('Error fetching dashboard data:', error)
                // No mock data fallback - show empty state with zeros
            } finally {
                setLoading(false)
            }
        }

        fetchDashboardData()
    }, [user])

    const { insights } = useAIInsights()
    const anomalies: Insight[] = insights.filter(i => i.type === 'anomaly')

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header with Quick Actions */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Welcome back! Here's your financial overview.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild className="w-full sm:w-auto">
                        <Link to="/transactions?action=new">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Transaction
                        </Link>
                    </Button>
                </div>
            </div>

            {/* AI Coaching Section */}
            <AICoach />

            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Balance"
                    value={formatCurrency(stats.totalBalance)}
                    trendDescription={stats.totalBalance >= 0 ? "Net worth positive" : "Building up"}
                    subtitle="Across all accounts"
                    changeType={stats.totalBalance >= 0 ? "positive" : "neutral"}
                />
                <StatCard
                    title="Monthly Income"
                    value={formatCurrency(stats.monthlyIncome)}
                    percentageChange={`${stats.incomeChange >= 0 ? '+' : ''}${stats.incomeChange.toFixed(1)}%`}
                    trendDescription={stats.incomeChange >= 0 ? "Up from last month" : "Down from last month"}
                    subtitle="Income this period"
                    changeType={stats.incomeChange >= 0 ? "positive" : "negative"}
                />
                <StatCard
                    title="Monthly Expenses"
                    value={formatCurrency(stats.monthlyExpenses)}
                    percentageChange={`${stats.expensesChange >= 0 ? '+' : ''}${stats.expensesChange.toFixed(1)}%`}
                    trendDescription={stats.expensesChange <= 0 ? "Down from last month" : "Up from last month"}
                    subtitle={stats.expensesChange <= 0 ? "Spending under control" : "Review spending"}
                    changeType={stats.expensesChange <= 0 ? "positive" : "negative"}
                />
                <StatCard
                    title="Monthly Net"
                    value={formatCurrency(stats.monthlyNet)}
                    percentageChange={`${stats.savingsRate >= 0 ? '+' : ''}${stats.savingsRate.toFixed(1)}%`}
                    trendDescription={stats.monthlyNet >= 0 ? 'Savings rate' : 'Needs attention'}
                    subtitle={stats.monthlyNet >= 0 ? 'Income saved' : 'Review spending'}
                    changeType={stats.monthlyNet >= 0 ? 'positive' : 'negative'}
                />
            </div>

            {/* Health Score & Spending Flow Row */}
            <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-2">
                <FinancialHealthScore data={healthData} loading={healthLoading} />
                <BudgetOverview spendingByCategory={spendingByCategory} />
            </div>

            {/* Monthly Trends Chart */}
            <div className="w-full">
                <SpendingChart data={monthlyTrends} />
            </div>

            {/* Recent Transactions */}
            <RecentTransactions transactions={recentTransactions} anomalies={anomalies} />
        </div>
    )
}
