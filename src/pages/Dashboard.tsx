import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    StatCard,
    RecentTransactions,
    SpendingChart,
    BudgetOverview,
    AICoach,
    FinancialHealthScore,
    BadgesGrid
} from '@/components/dashboard'
import { supabase } from '@/lib/supabase'
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

                // 1. Fetch recent transactions with expanded details
                const { data: transactions } = await supabase
                    .from('transactions')
                    .select(`
                        *,
                        category:categories(*),
                        account:accounts(*)
                    `)
                    .eq('user_id', user.id)
                    .order('date', { ascending: false })
                    .limit(10)

                if (transactions) {
                    setRecentTransactions(transactions as Transaction[])
                }

                // 2. Fetch both current and last month data for comparison
                const { data: twoMonthData } = await supabase
                    .from('transactions')
                    .select(`
                        type,
                        amount,
                        date,
                        category:categories(name, color)
                    `)
                    .eq('user_id', user.id)
                    .gte('date', startOfLastMonthStr)

                if (twoMonthData) {
                    // Split into current and last month
                    const currentMonthData = twoMonthData.filter(t => t.date >= startOfMonthStr)
                    const lastMonthData = twoMonthData.filter(t => t.date >= startOfLastMonthStr && t.date < startOfMonthStr)

                    // Calculate current month stats
                    const income = currentMonthData
                        .filter((t) => t.type === 'income')
                        .reduce((sum, t) => sum + t.amount, 0)
                    const expenses = currentMonthData
                        .filter((t) => t.type === 'expense')
                        .reduce((sum, t) => sum + t.amount, 0)

                    // Calculate last month stats for comparison
                    const lastMonthIncome = lastMonthData
                        .filter((t) => t.type === 'income')
                        .reduce((sum, t) => sum + t.amount, 0)
                    const lastMonthExpenses = lastMonthData
                        .filter((t) => t.type === 'expense')
                        .reduce((sum, t) => sum + t.amount, 0)

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
                            const category = Array.isArray(t.category) ? t.category[0] : t.category
                            const catName = (category as Category)?.name || 'Uncategorized'
                            const catColor = (category as Category)?.color || '#94a3b8'
                            const current = categoryMap.get(catName) || { amount: 0, color: catColor }
                            categoryMap.set(catName, {
                                amount: current.amount + t.amount,
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
                const { data: trendData } = await supabase
                    .from('transactions')
                    .select('type, amount, date')
                    .eq('user_id', user.id)
                    .gte('date', sixMonthsAgoStr)
                    .order('date', { ascending: true })

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
                            if (t.type === 'income') current.income += t.amount
                            if (t.type === 'expense') current.expenses += t.amount
                        }
                    })

                    // Convert map to array and reverse to show chronological order if needed
                    // (But we inserted keys in reverse order, so we might want to fix the order)
                    // Better approach: Generate array of keys in chronological order first
                    const orderedMonths: string[] = []
                    for (let i = 5; i >= 0; i--) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                        orderedMonths.push(d.toLocaleString('default', { month: 'short' }))
                    }

                    const monthlyTrendData: MonthlyTrend[] = orderedMonths.map(month => ({
                        month,
                        income: monthsMap.get(month)?.income || 0,
                        expenses: monthsMap.get(month)?.expenses || 0
                    }))

                    setMonthlyTrends(monthlyTrendData)
                }

                // 4. Fetch accounts for total balance
                const { data: accounts } = await supabase
                    .from('accounts')
                    .select('balance')
                    .eq('user_id', user.id)
                    .eq('is_active', true)

                if (accounts) {
                    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
                    setStats((prev) => ({ ...prev, totalBalance }))
                }
            } catch (error) {
                console.error('Error fetching dashboard data, falling back to mock data:', error)
                loadMockData()
            } finally {
                setLoading(false)
            }
        }

        const loadMockData = () => {
            // Mock Data for Offline/Error State
            setStats({
                totalBalance: 12450.00,
                monthlyIncome: 4500.00,
                monthlyExpenses: 2150.00,
                monthlyNet: 2350.00,
                savingsRate: 52,
                lastMonthIncome: 4200.00,
                lastMonthExpenses: 2300.00,
                incomeChange: 7.1,
                expensesChange: -6.5,
            })

            setMonthlyTrends([
                { month: 'Jan', income: 4000, expenses: 2400 },
                { month: 'Feb', income: 3000, expenses: 1398 },
                { month: 'Mar', income: 2000, expenses: 9800 },
                { month: 'Apr', income: 2780, expenses: 3908 },
                { month: 'May', income: 1890, expenses: 4800 },
                { month: 'Jun', income: 2390, expenses: 3800 },
            ])

            setSpendingByCategory([
                { category: 'Food & Dining', amount: 850, percentage: 35, color: '#ef4444' },
                { category: 'Transportation', amount: 350, percentage: 15, color: '#f97316' },
                { category: 'Bills', amount: 550, percentage: 25, color: '#f59e0b' },
                { category: 'Entertainment', amount: 400, percentage: 25, color: '#8b5cf6' },
            ])

            setRecentTransactions([
                {
                    id: '1',
                    type: 'expense',
                    amount: 45.99,
                    date: new Date().toISOString(),
                    description: 'Grocery Store',
                    category: { id: '1', user_id: '', name: 'Food & Dining', type: 'expense', color: '#ef4444', icon: '', parent_id: null, created_at: '' }
                },
                {
                    id: '2',
                    type: 'income',
                    amount: 2500.00,
                    date: new Date(Date.now() - 86400000).toISOString(),
                    description: 'Freelance Payment',
                    category: { id: '2', user_id: '', name: 'Freelance', type: 'income', color: '#10b981', icon: '', parent_id: null, created_at: '' }
                },
                {
                    id: '3',
                    type: 'expense',
                    amount: 120.00,
                    date: new Date(Date.now() - 172800000).toISOString(),
                    description: 'Electric Bill',
                    category: { id: '3', user_id: '', name: 'Bills', type: 'expense', color: '#f59e0b', icon: '', parent_id: null, created_at: '' }
                },
            ] as Transaction[])
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

            {/* Financial Health & Gamification Row */}
            <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-[3fr_7fr]">
                <FinancialHealthScore data={healthData} loading={healthLoading} />
                <BadgesGrid badges={healthData?.badges || []} />
            </div>

            {/* Charts Row - 70/30 Split */}
            <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-[7fr_3fr]">
                <SpendingChart data={monthlyTrends} />
                <BudgetOverview spendingByCategory={spendingByCategory} />
            </div>

            {/* Recent Transactions */}
            <RecentTransactions transactions={recentTransactions} anomalies={anomalies} />
        </div>
    )
}
