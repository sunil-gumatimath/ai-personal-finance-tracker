import { useState, useEffect, useCallback, useRef } from 'react'
import { api, RequestAbortedError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { toNumber } from '@/lib/number'
import { toMonthlyEquivalent } from '@/lib/budget-periods'
import { isDateInRange, savingsRatePercent, savingsScoreFromPercent, toDateKey, toMonthKey } from '@/lib/date-range'
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

    /**
     * Request generation counter.
     *
     * `refresh` is exposed to callers, so two runs can overlap (a click plus a
     * remount, or StrictMode's double-invoke). Whichever resolved last used to
     * win, regardless of which was newer. The counter makes the newest request
     * authoritative and lets a superseded one bail out before it can overwrite
     * fresher data.
     */
    const seqRef = useRef(0)

    // NOTE: deliberately does NOT depend on formatCurrency/preferences.
    // All currency values are stored raw; formatting happens at render time.
    const calculateHealth = useCallback(async (signal?: AbortSignal) => {
        const seq = ++seqRef.current
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
                api.transactions.list({ since: threeMonthsAgo }, signal),
                api.budgets.list(signal),
                api.accounts.list(signal)
            ])

            const typedTransactions = (transactionsRes.transactions || []) as Transaction[]
            const typedBudgets = (budgetsRes.budgets || []) as (Budget & { category: { name: string } })[]
            const typedAccounts = (accountsRes.accounts || []) as Account[]

            // 1. Savings Rate Calculation
            //
            // `isDateInRange` replaces `String(t.date).split('T')[0]`, which is
            // the UTC-parse path for a `Date` (String(Date) has no "T", so the
            // split returned the whole string) — the exact trap
            // `parseTransactionDate` documents.
            const currentMonthTransactions = typedTransactions.filter(t =>
                isDateInRange(t.date, startOfCurrMonth, endOfCurrMonth)
            )

            const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((sum: number, t) => sum + toNumber(t.amount), 0)
            const expenses = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum: number, t) => sum + toNumber(t.amount), 0)
            // Signed percentage, matching the Dashboard and Reports. The
            // `savingsRate` exposed on this hook is therefore a percentage like
            // everywhere else, not the 0..1 ratio it used to be.
            const savingsRate = savingsRatePercent(income, expenses)

            // 2. Budget Adherence
            //
            // Use the server's `spent`, which is computed by the single shared
            // budget window in `api/_domain/budgets.ts`. This hook used to
            // re-derive current-month spending locally and compare it against
            // the raw `b.amount`, ignoring `b.period` entirely — so a weekly
            // ₹500 limit was measured against a full month of spending, and a
            // yearly limit looked permanently "on track". Because adherence is
            // 30% of the score, the Financial Health card disagreed with the
            // Budgets page by construction.
            let totalBudgeted = 0
            let categoriesOnTrack = 0
            typedBudgets.forEach(b => {
                const limit = toNumber(b.amount)
                // Normalise to a monthly equivalent so mixed periods aggregate
                // honestly — the same helper the Budgets page uses, so the two
                // surfaces cannot report different totals for one user.
                totalBudgeted += toMonthlyEquivalent(limit, b.period)
                // `spent` is authoritative; fall back to 0 (not a local
                // re-derivation) if an older server omits it.
                const spent = toNumber((b as { spent?: number | string }).spent)
                if (spent <= limit) {
                    categoriesOnTrack++
                }
            })
            const budgetAdherence = typedBudgets.length > 0 ? categoriesOnTrack / typedBudgets.length : 1

            // 3. Emergency Fund Progress
            const savingsAccounts = typedAccounts.filter(a => a.type === 'savings' || (a.name ?? '').toLowerCase().includes('emergency'))
            // Handle PostgreSQL DECIMAL type which may come as string
            const currentEmergencyFund = savingsAccounts.reduce((sum, a) => sum + toNumber(a.balance), 0)

            // Average the months we actually have data for.
            //
            // This used to divide by a hardcoded 3 regardless of how much
            // history existed, so a user with ONE month of ₹30,000 expenses got
            // avgMonthlyExpenses = ₹10,000 and an emergency-fund target of
            // ₹60,000 instead of ₹1,80,000 — telling them they were 3× further
            // along than they were. Count the distinct months that actually
            // contain spend, and fall back when there is no history at all.
            const pastExpenseAmounts: number[] = []
            let pastExpenses = 0
            const pastMonthsWithSpend = new Set<string>()
            typedTransactions
                .filter(t => {
                    if (t.type !== 'expense') return false
                    const key = toDateKey(t.date)
                    return key >= threeMonthsAgo && key < startOfCurrMonth
                })
                .forEach(t => {
                    const amount = toNumber(t.amount)
                    pastExpenses += amount
                    pastExpenseAmounts.push(amount)
                    // Local YYYY-MM key, so timezone can't split one month in two.
                    pastMonthsWithSpend.add(toMonthKey(t.date))
                })
            // True median (mean of the two middle values on an even count).
            // `Math.floor((n - 1) / 2)` returns the LOWER middle element, so
            // [10, 20] reported 10 instead of 15.
            const sortedPast = [...pastExpenseAmounts].sort((a, b) => a - b)
            const medianExpense = sortedPast.length > 0
                ? (sortedPast.length % 2 === 1
                    ? sortedPast[(sortedPast.length - 1) / 2]
                    : (sortedPast[sortedPast.length / 2 - 1] + sortedPast[sortedPast.length / 2]) / 2)
                : 0
            const monthsOfHistory = pastMonthsWithSpend.size
            const avgMonthlyExpenses = pastExpenses > 0 && monthsOfHistory > 0
                ? pastExpenses / monthsOfHistory
                : medianExpense > 0
                    ? medianExpense
                    : (expenses > 0 ? expenses : 2000) // last-resort static fallback for brand-new users
            const targetEmergencyFund = avgMonthlyExpenses * 6
            const emergencyFundProgress = Math.min(1, currentEmergencyFund / targetEmergencyFund)

            // 4. Score Calculation (Weights: Savings 40%, Budget 30%, Emergency 30%)
            //
            // `savingsRate` is already a percentage, and the clamp lives in
            // `savingsScoreFromPercent`. It used to be a 0..1 ratio here, so this
            // multiplied by 100 — and a clamped 0 (from `Math.max(0, ...)`)
            // scored identically to exactly break-even.
            const savingsScore = savingsScoreFromPercent(savingsRate)
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
                // `savingsRate` is a percentage, so the threshold is 20 (was 0.2
                // against a 0..1 ratio).
                if (savingsRate < 20 && income > 0) {
                    nextSteps.push({ kind: 'savings-boost', amount: Math.round(income * 0.1) })
                } else if (savingsRate < 20 && income === 0) {
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
            // An unmount-driven abort is control flow, not a failure.
            if (error instanceof RequestAbortedError) return
            if (seq !== seqRef.current) return
            console.error('Error calculating financial health:', error)
            setError(error instanceof Error ? error.message : 'Failed to calculate your financial health score.')
        } finally {
            if (seq === seqRef.current) setLoading(false)
        }
    }, [user])

    useEffect(() => {
        // Abort on unmount so a slow response cannot set state on a component
        // that no longer exists.
        const controller = new AbortController()
        void calculateHealth(controller.signal)
        return () => controller.abort()
    }, [calculateHealth])

    return { data, loading, error, refresh: () => calculateHealth() }
}
