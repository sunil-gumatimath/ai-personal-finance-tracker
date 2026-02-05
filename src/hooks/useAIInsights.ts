import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

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
    const [insights, setInsights] = useState<Insight[]>([])
    const [loading, setLoading] = useState(true)

    const fetchInsights = useCallback(async () => {
        if (!user) return

        try {
            setLoading(true)
            const res = await api.ai.insights.list()
            const rows = (res.insights || []) as Insight[]
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
            const res = await api.ai.insights.generate(forceRefresh)
            const rows = (res.insights || []) as Insight[]
            setInsights(rows)
        } catch (error) {
            console.error('Error generating insights:', error)
        } finally {
            setLoading(false)
        }
    }, [user, fetchInsights])

    const dismissInsight = useCallback(async (id: string) => {
        if (!user) return
        try {
            await api.ai.insights.dismiss(id)
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
