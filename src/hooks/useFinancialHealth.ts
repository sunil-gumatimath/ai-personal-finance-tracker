import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { toNumber } from '@/lib/number'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import type { Transaction, Budget, Account } from '@/types'

/**
 * A recommended action. Currency amounts are kept RAW here and formatted at
 * render time (the component owns formatCurrency) so changing the user's
 * currency never re-runs this hook's fetch/calculation chain.
 */
export type HealthNextStep =
    | { kind: 'message'; text: string }
    | { kind: 'savings-boost'; amount: number }
    | { kind: 'emergency-fund'; amount: number }

export interface FinancialHealth {
    score: number
    savingsRate: number
    budgetAdherence: number
    emergencyFundProgress: number
    hasEnoughData: boolean
    metrics: {
        monthlyIncome: number
        monthlyExpenses: number
        totalBudgeted: number
        totalSpent: number
        targetEmergencyFund: number
        currentEmergencyFund: number
    }
    nextSteps: HealthNextStep[]
}

/** Formats a raw step into human copy using the caller's currency formatter. */
export function formatHealthNextStep(
    step: HealthNextStep,
    formatCurrency: (amount: number) => string,
): string {
    switch (step.kind) {
        case 'savings-boost':
            return `Increase monthly savings by ${formatCurrency(step.amount)} to boost your score.`
        case 'emergency-fund':
            return `Add ${formatCurrency(step.amount)} to your emergency fund.`
        default:
            return step.text
    }
}

export function useFinancialHealth() {
    const { user } = useAuth()
    const [data, setData] = useState<FinancialHealth | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // NOTE: deliberately does NOT depend on formatCurrency/preferences.
    // All currency values are stored raw; formatting happens at render time.
    const calculateHealth = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            setError(null)
            setLoading(true)
            const now = new Date()
            const startOfCurrMonth = format(startOfMonth(now), 'yyyy-MM-dd')
            const endOfCurrMonth = format(endOfMonth(now), 'yyyy-MM-dd')

            // Fetch all necessary data
            const threeMonthsAgo = format(subMonths(startOfMonth(now), 3), 'yyyy-MM-dd')
            const [
                transactionsRes,
                budgetsRes,
                accountsRes
            ] = await Promise.all([
                api.transactions.list({ since: threeMonthsAgo }),
                api.budgets.list(),
                api.accounts.list()
            ])

            const typedTransactions = (transactionsRes.transactions || []) as Transaction[]
            const typedBudgets = (budgetsRes.budgets || []) as (Budget & { category: { name: string } })[]
            const typedAccounts = (accountsRes.accounts || []) as Account[]

            // 1. Savings Rate Calculation
            const currentMonthTransactions = typedTransactions.filter(t => {
                const dateStr = String(t.date).split('T')[0]
                return dateStr >= startOfCurrMonth && dateStr <= endOfCurrMonth
            })

            const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((sum: number, t) => sum + toNumber(t.amount), 0)
            const expenses = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum: number, t) => sum + toNumber(t.amount), 0)
            const savingsRate = income > 0 ? Math.max(0, (income - expenses) / income) : 0

            // 2. Budget Adherence
            const spendingByCategory = new Map<string, number>()
            currentMonthTransactions.filter(t => t.type === 'expense').forEach(t => {
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
            const savingsAccounts = typedAccounts.filter(a => a.type === 'savings' || (a.name ?? '').toLowerCase().includes('emergency'))
            // Handle PostgreSQL DECIMAL type which may come as string
            const currentEmergencyFund = savingsAccounts.reduce((sum, a) => sum + toNumber(a.balance), 0)

            // Fetch last 3 months expenses to average; keep per-transaction amounts
            // so we can fall back to the median when there is no history at all.
            const pastExpenseAmounts: number[] = []
            let pastExpenses = 0
            typedTransactions
                .filter(t => {
                    const dateStr = String(t.date).split('T')[0]
                    return t.type === 'expense' && dateStr >= threeMonthsAgo && dateStr < startOfCurrMonth
                })
                .forEach(t => {
                    const amount = toNumber(t.amount)
                    pastExpenses += amount
                    pastExpenseAmounts.push(amount)
                })
            // Median of observed expenses (robust to one-off spikes); falls back
            // to this month, and only then to a static $2,000 assumption.
            const sortedPast = [...pastExpenseAmounts].sort((a, b) => a - b)
            const medianExpense = sortedPast.length > 0
                ? (sortedPast[Math.floor((sortedPast.length - 1) / 2)] ?? 0)
                : 0
            const avgMonthlyExpenses = pastExpenses > 0
                ? pastExpenses / 3
                : medianExpense > 0
                    ? medianExpense
                    : (expenses > 0 ? expenses : 2000) // last-resort static fallback for brand-new users
            const targetEmergencyFund = avgMonthlyExpenses * 6
            const emergencyFundProgress = Math.min(1, currentEmergencyFund / targetEmergencyFund)

            // 4. Score Calculation (Weights: Savings 40%, Budget 30%, Emergency 30%)
            const savingsScore = Math.min(100, savingsRate * 100)
            const budgetScore = budgetAdherence * 100
            const efScore = emergencyFundProgress * 100

            const rawScore = (savingsScore * 0.4) + (budgetScore * 0.3) + (efScore * 0.3)
            const finalScore = Math.round(rawScore)

            // Determine if we have enough data to show a meaningful score
            const hasEnoughData = income > 0 || expenses > 0 || currentMonthTransactions.length > 0

            // Check if user has debt (for next steps)
            const hasDebt = typedAccounts.some(a => a.type === 'credit' && toNumber(a.balance) < 0)

            // 6. Generate Next Steps (Actionable Advice) — amounts stay raw;
            // formatHealthNextStep() applies the currency at render time.
            const nextSteps: HealthNextStep[] = []

            if (!hasEnoughData) {
                nextSteps.push({ kind: 'message', text: 'Add your first income or expense transaction to start tracking.' })
                nextSteps.push({ kind: 'message', text: 'Set up budgets for your spending categories.' })
            } else {
                if (savingsRate < 0.2 && income > 0) {
                    nextSteps.push({ kind: 'savings-boost', amount: Math.round(income * 0.1) })
                } else if (savingsRate < 0.2 && income === 0) {
                    nextSteps.push({ kind: 'message', text: 'Add your income transactions to accurately track your savings rate.' })
                }
                if (budgetAdherence < 0.8) {
                    nextSteps.push({ kind: 'message', text: 'Review categories that are over budget and adjust spending.' })
                }
                if (emergencyFundProgress < 0.5) {
                    nextSteps.push({ kind: 'emergency-fund', amount: Math.round(targetEmergencyFund * 0.1) })
                }
                if (hasDebt) {
                    nextSteps.push({ kind: 'message', text: 'Prioritize paying off high-interest credit card debt.' })
                }
                if (nextSteps.length === 0) {
                    nextSteps.push({ kind: 'message', text: 'Great job! Maintain your current habits to keep your score high.' })
                }
            }

            setData({
                score: finalScore,
                savingsRate,
                budgetAdherence,
                emergencyFundProgress,
                hasEnoughData,
                metrics: {
                    monthlyIncome: income,
                    monthlyExpenses: expenses,
                    totalBudgeted,
                    totalSpent: expenses,
                    targetEmergencyFund,
                    currentEmergencyFund
                },
                nextSteps: nextSteps.slice(0, 2) // Top 2 recommendations
            })

        } catch (error) {
            console.error('Error calculating financial health:', error)
            setError(error instanceof Error ? error.message : 'Failed to calculate your financial health score.')
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        calculateHealth()
    }, [calculateHealth])

    return { data, loading, error, refresh: calculateHealth }
}
