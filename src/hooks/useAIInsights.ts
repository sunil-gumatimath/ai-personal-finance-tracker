import { useState, useEffect, useCallback } from 'react'
import { query } from '@/lib/database'
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
    is_dismissed?: boolean
    created_at?: string
}

export function useAIInsights() {
    const { user } = useAuth()
    const { formatCurrency, preferences } = usePreferences()
    const [insights, setInsights] = useState<Insight[]>([])
    const [loading, setLoading] = useState(true)

    const fetchInsights = useCallback(async () => {
        if (!user) return

        try {
            setLoading(true)
            // Fetch non-dismissed insights from the last 7 days
            const { rows } = await query<Insight>(`
                SELECT * FROM ai_insights 
                WHERE user_id = $1 
                AND is_dismissed = false 
                AND created_at > NOW() - INTERVAL '7 days'
                ORDER BY created_at DESC
            `, [user.id])

            if (rows.length > 0) {
                setInsights(rows)
                setLoading(false)
                return rows
            }
            return []
        } catch (error) {
            console.error('Error fetching insights:', error)
            return []
        } finally {
            setLoading(false)
        }
    }, [user])

    const generateInsights = useCallback(async (forceRefresh = false) => {
        if (!user) {
            setLoading(false)
            return
        }

        // 1. Try to fetch existing insights first (if not forcing refresh)
        if (!forceRefresh) {
            const existing = await fetchInsights()
            if (existing && existing.length > 0) return
        }

        try {
            setLoading(true)
            const sixMonthsAgo = subMonths(startOfMonth(new Date()), 6)
            const sixMonthsAgoStr = format(sixMonthsAgo, 'yyyy-MM-dd')

            const { rows: transactions } = await query<Transaction>(`
                SELECT t.*, row_to_json(c.*) as category
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_id = $1
                AND t.date >= $2
                ORDER BY t.date DESC
            `, [user.id, sixMonthsAgoStr])

            const typedTransactions = (transactions || []) as Transaction[]
            const newInsights: Omit<Insight, 'id'>[] = []

            // 2. Rule-based Anomaly Detection
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

            // 3. Gemini-powered Personalized Coaching (only if API key available)
            const hasApiKey = !!preferences.geminiApiKey

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
                        const aiInsights = JSON.parse(cleaned) as Array<{ type: 'coaching' | 'kudo'; title: string; description: string }>
                        aiInsights.forEach((insight) => {
                            newInsights.push({
                                ...insight,
                                type: insight.type as 'coaching' | 'kudo'
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
                    type: 'coaching',
                    title: 'Financial Health Tip',
                    description: 'Try the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings.'
                })
            }

            // 4. Save to Database
            // First, clear old insights to avoid duplicates (optional strategy) or just append?
            // Let's append but maybe we should check duplicates. For simplicity, just inserting.
            const savedInsights: Insight[] = []

            for (const insight of newInsights) {
                try {
                    const { rows } = await query<Insight>(`
                        INSERT INTO ai_insights (user_id, type, title, description, category, amount, date)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        RETURNING *
                    `, [
                        user.id,
                        insight.type,
                        insight.title,
                        insight.description,
                        insight.category || null,
                        insight.amount || null,
                        insight.date || null
                    ])
                    if (rows[0]) savedInsights.push(rows[0])
                } catch (e) {
                    console.error('Failed to save insight:', e)
                }
            }

            setInsights(savedInsights)
        } catch (error) {
            console.error('Error generating insights:', error)
        } finally {
            setLoading(false)
        }
    }, [user, preferences.currency, preferences.geminiApiKey, formatCurrency, fetchInsights])

    const dismissInsight = useCallback(async (id: string) => {
        if (!user) return
        try {
            await query('UPDATE ai_insights SET is_dismissed = true WHERE id = $1 AND user_id = $2', [id, user.id])
            setInsights(prev => prev.filter(i => i.id !== id))
        } catch (error) {
            console.error('Error dismissing insight:', error)
        }
    }, [user])

    useEffect(() => {
        // Initial load
        fetchInsights()
    }, [fetchInsights])

    return {
        insights,
        loading,
        refresh: () => generateInsights(true),
        dismissInsight
    }
}
