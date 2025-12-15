import { useState, useEffect } from 'react'
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard, RecentTransactions, SpendingChart, BudgetOverview } from '@/components/dashboard'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import type { Transaction, DashboardStats, SpendingByCategory, MonthlyTrend, Category } from '@/types'
import { Link } from 'react-router-dom'

export function Dashboard() {
    const { user } = useAuth()
    const { formatCurrency } = usePreferences()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<DashboardStats>({
        totalBalance: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        monthlyNet: 0,
        savingsRate: 0,
    })
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
    const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([])
    const [spendingByCategory, setSpendingByCategory] = useState<SpendingByCategory[]>([])

    useEffect(() => {
        async function fetchDashboardData() {
            if (!user) {
                setLoading(false)
                return
            }

            try {
                const now = new Date()
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
                const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

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

                // 2. Fetch monthly data for stats and category breakdown
                const { data: currentMonthData } = await supabase
                    .from('transactions')
                    .select(`
                        type,
                        amount,
                        category:categories(name, color)
                    `)
                    .eq('user_id', user.id)
                    .gte('date', startOfMonth.toISOString())

                if (currentMonthData) {
                    // Calculate Stats
                    const income = currentMonthData
                        .filter((t) => t.type === 'income')
                        .reduce((sum, t) => sum + t.amount, 0)
                    const expenses = currentMonthData
                        .filter((t) => t.type === 'expense')
                        .reduce((sum, t) => sum + t.amount, 0)

                    setStats({
                        totalBalance: 0, // Will be updated by accounts fetch
                        monthlyIncome: income,
                        monthlyExpenses: expenses,
                        monthlyNet: income - expenses,
                        savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
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
                    .gte('date', sixMonthsAgo.toISOString())
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

    // formatCurrency is now provided by usePreferences hook

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
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Welcome back! Here's your financial overview.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild>
                        <Link to="/transactions?action=new">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Transaction
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Balance"
                    value={formatCurrency(stats.totalBalance)}
                    change="Across all accounts"
                    changeType="neutral"
                    icon={Wallet}
                />
                <StatCard
                    title="Monthly Income"
                    value={formatCurrency(stats.monthlyIncome)}
                    change={`${stats.savingsRate.toFixed(0)}% savings rate`}
                    changeType="positive"
                    icon={TrendingUp}
                    iconColor="text-green-500"
                />
                <StatCard
                    title="Monthly Expenses"
                    value={formatCurrency(stats.monthlyExpenses)}
                    change="This month"
                    changeType="negative"
                    icon={TrendingDown}
                    iconColor="text-red-500"
                />
                <StatCard
                    title="Monthly Net"
                    value={formatCurrency(stats.monthlyNet)}
                    change={stats.monthlyNet >= 0 ? 'You\'re on track!' : 'Review spending'}
                    changeType={stats.monthlyNet >= 0 ? 'positive' : 'negative'}
                    icon={PiggyBank}
                    iconColor="text-blue-500"
                />
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
                <SpendingChart data={monthlyTrends} />
                <BudgetOverview spendingByCategory={spendingByCategory} />
            </div>

            {/* Recent Transactions */}
            <RecentTransactions transactions={recentTransactions} />
        </div>
    )
}
