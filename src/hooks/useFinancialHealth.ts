import { useState, useEffect, useCallback } from 'react'
import { query } from '@/lib/database'
import { useAuth } from '@/contexts/AuthContext'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import type { Transaction, Budget, Goal, Account } from '@/types'

export interface Badge {
    id: string
    name: string
    description: string
    icon: string
    unlocked: boolean
    progress: number // 0 to 100
    targetDisplay?: string // e.g., "Hit 30%"
}

export interface FinancialHealth {
    score: number
    savingsRate: number
    budgetAdherence: number
    emergencyFundProgress: number
    metrics: {
        monthlyIncome: number
        monthlyExpenses: number
        totalBudgeted: number
        totalSpent: number
        targetEmergencyFund: number
        currentEmergencyFund: number
    }
    badges: Badge[]
    nextSteps: string[]
}

export function useFinancialHealth() {
    const { user } = useAuth()
    const [data, setData] = useState<FinancialHealth | null>(null)
    const [loading, setLoading] = useState(true)

    const calculateHealth = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            const now = new Date()
            const startOfCurrMonth = format(startOfMonth(now), 'yyyy-MM-dd')
            const endOfCurrMonth = format(endOfMonth(now), 'yyyy-MM-dd')

            // Fetch all necessary data
            const [
                { rows: transactions },
                { rows: budgets },
                { rows: goals },
                { rows: accounts }
            ] = await Promise.all([
                query<Transaction>(`
                    SELECT 
                        t.*,
                        row_to_json(c.*) as category
                    FROM transactions t
                    LEFT JOIN categories c ON t.category_id = c.id
                    WHERE t.user_id = $1
                    AND t.date >= $2
                    AND t.date <= $3
                `, [user.id, startOfCurrMonth, endOfCurrMonth]),
                query<Budget & { category: { name: string } }>(`
                    SELECT 
                        b.*,
                        row_to_json(c.*) as category
                    FROM budgets b
                    LEFT JOIN categories c ON b.category_id = c.id
                    WHERE b.user_id = $1
                `, [user.id]),
                query<Goal>(`SELECT * FROM goals WHERE user_id = $1`, [user.id]),
                query<Account>(`SELECT * FROM accounts WHERE user_id = $1`, [user.id])
            ])

            const typedTransactions = (transactions || []) as Transaction[]
            const typedBudgets = (budgets || []) as (Budget & { category: { name: string } })[]
            const typedGoals = (goals || []) as Goal[]
            const typedAccounts = (accounts || []) as Account[]

            // Helper to safely parse number from PostgreSQL DECIMAL (which may come as string)
            const toNumber = (val: unknown): number => {
                if (typeof val === 'number') return isNaN(val) ? 0 : val
                if (typeof val === 'string') {
                    const parsed = parseFloat(val)
                    return isNaN(parsed) ? 0 : parsed
                }
                return 0
            }

            // 1. Savings Rate Calculation
            const income = typedTransactions.filter(t => t.type === 'income').reduce((sum: number, t) => sum + toNumber(t.amount), 0)
            const expenses = typedTransactions.filter(t => t.type === 'expense').reduce((sum: number, t) => sum + toNumber(t.amount), 0)
            const savingsRate = income > 0 ? Math.max(0, (income - expenses) / income) : 0

            // 2. Budget Adherence
            const spendingByCategory = new Map<string, number>()
            typedTransactions.filter(t => t.type === 'expense').forEach(t => {
                const catId = t.category_id || 'uncategorized'
                spendingByCategory.set(catId, (spendingByCategory.get(catId) || 0) + toNumber(t.amount))
            })

            let totalBudgeted = 0
            let categoriesOnTrack = 0
            typedBudgets.forEach(b => {
                totalBudgeted += toNumber(b.amount)
                const spent = spendingByCategory.get(b.category_id) || 0
                if (spent <= toNumber(b.amount)) {
                    categoriesOnTrack++
                }
            })
            const budgetAdherence = typedBudgets.length > 0 ? categoriesOnTrack / typedBudgets.length : 1

            // 3. Emergency Fund Progress
            const savingsAccounts = typedAccounts.filter(a => a.type === 'savings' || a.name.toLowerCase().includes('emergency'))
            // Handle PostgreSQL DECIMAL type which may come as string
            const currentEmergencyFund = savingsAccounts.reduce((sum, a) => {
                const balance = typeof a.balance === 'string' ? parseFloat(a.balance) : a.balance
                return sum + (isNaN(balance) ? 0 : balance)
            }, 0)

            // Fetch last 3 months expenses to average
            const threeMonthsAgo = format(subMonths(startOfMonth(now), 3), 'yyyy-MM-dd')
            const { rows: pastTransactions } = await query<{ amount: number }>(`
                SELECT amount 
                FROM transactions 
                WHERE user_id = $1 
                AND type = 'expense'
                AND date >= $2
                AND date < $3
            `, [user.id, threeMonthsAgo, startOfCurrMonth])

            const pastExpenses = (pastTransactions || []).reduce((sum, t) => sum + toNumber(t.amount), 0)
            const avgMonthlyExpenses = pastExpenses > 0 ? pastExpenses / 3 : (expenses > 0 ? expenses : 2000)
            const targetEmergencyFund = avgMonthlyExpenses * 6
            const emergencyFundProgress = Math.min(1, currentEmergencyFund / targetEmergencyFund)

            // 4. Score Calculation (Weights: Savings 40%, Budget 30%, Emergency 30%)
            const savingsScore = Math.min(100, savingsRate * 100)
            const budgetScore = budgetAdherence * 100
            const efScore = emergencyFundProgress * 100

            const rawScore = (savingsScore * 0.4) + (budgetScore * 0.3) + (efScore * 0.3)
            const finalScore = Math.round(rawScore)

            // 5. Badges Logic with Progress
            // Frugal King: Stay 20% under budget
            const targetExpenseParams = totalBudgeted * 0.8
            const isFrugalUnlocked = totalBudgeted > 0 && expenses <= targetExpenseParams
            const frugalProgress = totalBudgeted > 0
                ? Math.min(100, Math.max(0, ((totalBudgeted - expenses) / (totalBudgeted - targetExpenseParams)) * 100))
                : 0

            // Goal Crusher: Any goal reached?
            // Progress = max % of any single goal
            const maxGoalProgress = typedGoals.reduce((max, g) => {
                const targetAmt = toNumber(g.target_amount)
                const currentAmt = toNumber(g.current_amount)
                const prog = targetAmt > 0 ? (currentAmt / targetAmt) * 100 : 0
                return Math.max(max, prog)
            }, 0)
            const isGoalUnlocked = typedGoals.some(g => toNumber(g.current_amount) >= toNumber(g.target_amount))

            // Debt Slayer: No negative credit balance
            // Progress: Based on how much debt is paid off vs total credit limit? Hard to say without limit.
            // Simplified: If credit balance < 0, progress is 0. If >= 0, 100.
            const hasDebt = typedAccounts.some(a => a.type === 'credit' && toNumber(a.balance) < 0)

            // Savings Star: >30% savings rate
            const isSavingsUnlocked = savingsRate >= 0.3
            const savingsProgress = Math.min(100, (savingsRate / 0.3) * 100)

            const badges: Badge[] = [
                {
                    id: 'frugal-king',
                    name: 'Frugal King',
                    description: 'Stay 20% under total budget',
                    icon: 'Crown',
                    unlocked: isFrugalUnlocked,
                    progress: isFrugalUnlocked ? 100 : frugalProgress,
                    targetDisplay: '20% Under'
                },
                {
                    id: 'goal-crusher',
                    name: 'Goal Crusher',
                    description: 'Reach a savings goal',
                    icon: 'Target',
                    unlocked: isGoalUnlocked,
                    progress: Math.min(100, maxGoalProgress),
                    targetDisplay: '100% Goal'
                },
                {
                    id: 'debt-slayer',
                    name: 'Debt Slayer',
                    description: 'Be debt-free on credit cards',
                    icon: 'Sword',
                    unlocked: !hasDebt,
                    progress: !hasDebt ? 100 : 0, // Binary for now
                    targetDisplay: '0 Debt'
                },
                {
                    id: 'savings-star',
                    name: 'Savings Star',
                    description: 'Achieve 30% savings rate',
                    icon: 'Star',
                    unlocked: isSavingsUnlocked,
                    progress: savingsProgress,
                    targetDisplay: '30% Rate'
                }
            ]

            // 6. Generate Next Steps (Actionable Advice)
            const nextSteps: string[] = []
            if (savingsRate < 0.2) {
                nextSteps.push(`Increase monthly savings by $${Math.round(income * 0.1)} to boost your score.`)
            }
            if (budgetAdherence < 0.8) {
                nextSteps.push('Review categories that are over budget and adjust spending.')
            }
            if (emergencyFundProgress < 0.5) {
                nextSteps.push(`Add $${Math.round(targetEmergencyFund * 0.1)} to your emergency fund.`)
            }
            if (hasDebt) {
                nextSteps.push('Prioritize paying off high-interest credit card debt.')
            }
            if (nextSteps.length === 0) {
                nextSteps.push('Great job! Maintain your current habits to keep your score high.')
            }

            setData({
                score: finalScore,
                savingsRate,
                budgetAdherence,
                emergencyFundProgress,
                metrics: {
                    monthlyIncome: income,
                    monthlyExpenses: expenses,
                    totalBudgeted,
                    totalSpent: expenses,
                    targetEmergencyFund,
                    currentEmergencyFund
                },
                badges,
                nextSteps: nextSteps.slice(0, 2) // Top 2 recommendations
            })

        } catch (error) {
            console.error('Error calculating financial health:', error)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        calculateHealth()
    }, [calculateHealth])

    return { data, loading, refresh: calculateHealth }
}
