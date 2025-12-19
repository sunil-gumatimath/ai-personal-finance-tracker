import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Transaction, Category } from '@/types'
import { startOfMonth, subMonths, format } from 'date-fns'
import { usePreferences } from '@/hooks/usePreferences'
import { generateFinancialAdvice } from '@/lib/gemini'

export interface Insight {
    id: string
    type: 'anomaly' | 'coaching' | 'kudo'
    title: string
    description: string
    category?: string
    amount?: number
    impact?: number
    date?: string
}

const INSIGHTS_CACHE_KEY = 'financetrack_ai_insights'
const INSIGHTS_CACHE_TTL = 1000 * 60 * 30 // 30 minutes

interface CachedInsights {
    insights: Insight[]
    timestamp: number
    userId: string
}

export function useAIInsights() {
    const { user } = useAuth()
    const { formatCurrency, preferences } = usePreferences()
    const [insights, setInsights] = useState<Insight[]>([])
    const [loading, setLoading] = useState(true)

    const generateInsights = useCallback(async (forceRefresh = false) => {
        if (!user) {
            setLoading(false)
            return
        }

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            try {
                const cached = localStorage.getItem(INSIGHTS_CACHE_KEY)
                if (cached) {
                    const { insights: cachedInsights, timestamp, userId }: CachedInsights = JSON.parse(cached)
                    const isValid = Date.now() - timestamp < INSIGHTS_CACHE_TTL && userId === user.id
                    if (isValid && cachedInsights.length > 0) {
                        setInsights(cachedInsights)
                        setLoading(false)
                        return
                    }
                }
            } catch (e) {
                console.warn('Failed to load cached insights:', e)
            }
        }

        try {
            setLoading(true)
            const sixMonthsAgo = subMonths(startOfMonth(new Date()), 6)
            const sixMonthsAgoStr = format(sixMonthsAgo, 'yyyy-MM-dd')

            const { data: transactions, error } = await supabase
                .from('transactions')
                .select(`
                    *,
                    category:categories(*)
                `)
                .eq('user_id', user.id)
                .gte('date', sixMonthsAgoStr)
                .order('date', { ascending: false })

            if (error) throw error

            const typedTransactions = (transactions || []) as Transaction[]
            const newInsights: Insight[] = []

            // 1. Rule-based Anomaly Detection
            const categoryStats = new Map<string, { total: number; count: number; transactions: Transaction[] }>()

            typedTransactions.forEach(t => {
                if (t.type === 'expense' && t.category) {
                    const catName = (t.category as Category).name
                    const stats = categoryStats.get(catName) || { total: 0, count: 0, transactions: [] }
                    stats.total += t.amount
                    stats.count += 1
                    stats.transactions.push(t)
                    categoryStats.set(catName, stats)
                }
            })

            categoryStats.forEach((stats, catName) => {
                const average = stats.total / stats.count
                const recentTransactions = stats.transactions.slice(0, 3)
                recentTransactions.forEach(t => {
                    if (t.amount > average * 1.8 && t.amount > 50) {
                        newInsights.push({
                            id: `anomaly-${t.id}`,
                            type: 'anomaly',
                            title: 'Unusual Spending',
                            description: `You spent ${formatCurrency(t.amount)} on ${t.description || catName}, which is higher than your typical ${formatCurrency(average)} average.`,
                            category: catName,
                            amount: t.amount,
                            date: t.date
                        })
                    }
                })
            })

            // 2. Gemini-powered Personalized Coaching (only if API key available)
            const hasApiKey = preferences.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY

            if (hasApiKey && typedTransactions.length > 0) {
                const currentMonth = startOfMonth(new Date())
                const lastMonth = startOfMonth(subMonths(new Date(), 1))

                const spendingSummary = Array.from(categoryStats.entries()).map(([cat, stats]) => {
                    const currentMonthTotal = stats.transactions
                        .filter(t => startOfMonth(new Date(t.date)).getTime() === currentMonth.getTime())
                        .reduce((sum, t) => sum + t.amount, 0)
                    const lastMonthTotal = stats.transactions
                        .filter(t => startOfMonth(new Date(t.date)).getTime() === lastMonth.getTime())
                        .reduce((sum, t) => sum + t.amount, 0)
                    return { category: cat, currentMonthTotal, lastMonthTotal, average: stats.total / stats.count }
                })

                const prompt = `
                    I am a personal finance AI agent. Analyze the following spending data:
                    Currency: ${preferences.currency}
                    Category Stats: ${JSON.stringify(spendingSummary)}

                    Generate 2-3 specific, actionable financial insights focusing on:
                    - Spending shifts (Coaching)
                    - Success stories where spending decreased (Kudo)
                    - Actionable advice

                    Return ONLY a JSON array:
                    [{"type": "coaching" | "kudo", "title": "Title", "description": "Description"}]
                    No markdown, no extra text.
                `

                try {
                    const aiResponse = await generateFinancialAdvice(prompt, preferences.geminiApiKey)
                    if (aiResponse) {
                        const cleaned = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim()
                        const aiInsights = JSON.parse(cleaned)
                        aiInsights.forEach((insight: any, index: number) => {
                            newInsights.push({
                                id: `ai-${index}-${Date.now()}`,
                                ...insight
                            })
                        })
                    }
                } catch (e) {
                    console.error('Failed to generate AI insights:', e)
                }
            }

            // Fallback if no insights generated
            if (newInsights.length === 0) {
                newInsights.push({
                    id: 'general-1',
                    type: 'coaching',
                    title: 'Financial Health Tip',
                    description: 'Try the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings.'
                })
            }

            // Cache the results
            try {
                const cacheData: CachedInsights = {
                    insights: newInsights,
                    timestamp: Date.now(),
                    userId: user.id
                }
                localStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify(cacheData))
            } catch (e) {
                console.warn('Failed to cache insights:', e)
            }

            setInsights(newInsights)
        } catch (error) {
            console.error('Error generating insights:', error)
        } finally {
            setLoading(false)
        }
    }, [user, preferences.currency, preferences.geminiApiKey, formatCurrency])

    useEffect(() => {
        generateInsights()
    }, [generateInsights])

    return { insights, loading, refresh: () => generateInsights(true) }
}
