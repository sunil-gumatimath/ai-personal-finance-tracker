import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

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

export interface NotificationPreferences {
  notifications: boolean
  emailAlerts: boolean
  budgetAlerts: boolean
}

export interface NotificationData {
  preferences: NotificationPreferences
  budgetAlerts: BudgetAlert[]
  recentActivity: any[]
  unreadCount: number
}

export function useNotifications() {
  const [data, setData] = useState<NotificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.notifications.list()
      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }

  const createBudgetAlert = async (categoryId: string, message: string, severity: 'low' | 'medium' | 'high') => {
    try {
      await api.notifications.createBudgetAlert(categoryId, message, severity)
      await fetchNotifications() // Refresh notifications
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget alert')
    }
  }

  const updatePushSubscription = async (subscription: any) => {
    try {
      await api.notifications.updatePushSubscription(subscription)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update push subscription')
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  return {
    data,
    loading,
    error,
    refetch: fetchNotifications,
    createBudgetAlert,
    updatePushSubscription
  }
}
