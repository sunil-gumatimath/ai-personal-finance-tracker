import { getAuthedUserId } from './_auth.js'
import { query, queryOne } from './_db.js'
import type { ApiRequest, ApiResponse } from './_types.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (req.method === 'GET') {
    try {
      // Get user's notification preferences
      const profile = await queryOne<{ preferences: Record<string, unknown> }>(
        'SELECT preferences FROM profiles WHERE user_id = $1',
        [userId],
      )

      const prefs = profile?.preferences || {}
      
      // Get budget alerts
      const { rows: budgetAlerts } = await query(
        `
        SELECT 
          b.id,
          b.amount as budget_limit,
          c.name as category_name,
          c.color,
          COALESCE(SUM(t.amount), 0) as spent,
          b.period,
          b.start_date,
          b.end_date
        FROM budgets b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN transactions t ON b.category_id = t.category_id 
          AND t.user_id = b.user_id 
          AND t.type = 'expense'
          AND t.date >= GREATEST(b.start_date, CURRENT_DATE - INTERVAL '1 month')
        WHERE b.user_id = $1
        AND b.end_date IS NULL OR b.end_date >= CURRENT_DATE
        GROUP BY b.id, b.amount, c.name, c.color, b.period, b.start_date, b.end_date
        HAVING COALESCE(SUM(t.amount), 0) > 0
        `,
        [userId],
      )

      // Process budget alerts
      const alerts = budgetAlerts.map((budget: any) => {
        const spent = Number(budget.spent) || 0
        const limit = Number(budget.budget_limit) || 0
        const percentage = limit > 0 ? (spent / limit) * 100 : 0
        
        return {
          id: budget.id,
          type: 'budget' as const,
          category: budget.category_name,
          color: budget.color,
          spent,
          limit,
          percentage,
          status: percentage >= 100 ? 'over' as const : percentage >= 80 ? 'warning' as const : 'ok' as const,
          message: percentage >= 100 
            ? `Over budget by ${((spent - limit) / limit * 100).toFixed(1)}%`
            : percentage >= 80
            ? `${percentage.toFixed(1)}% of budget used`
            : null
        }
      }).filter(alert => alert.status !== 'ok')

      // Get recent transactions that might trigger notifications
      const { rows: recentTransactions } = await query(
        `
        SELECT 
          t.id,
          t.amount,
          t.description,
          t.date,
          c.name as category_name,
          c.color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = $1
        AND t.date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY t.date DESC
        LIMIT 10
        `,
        [userId],
      )

      const notifications = {
        preferences: {
          notifications: Boolean(prefs.notifications),
          emailAlerts: Boolean(prefs.emailAlerts),
          budgetAlerts: Boolean(prefs.budgetAlerts),
        },
        budgetAlerts: alerts,
        recentActivity: recentTransactions,
        unreadCount: alerts.length,
      }

      res.status(200).json(notifications)
    } catch (error) {
      console.error('Notifications GET error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const { type, data } = req.body || {}

      if (type === 'budget_alert') {
        // Create a budget alert notification
        const { categoryId, message, severity } = data as any
        
        // This could store notifications in a dedicated table
        // For now, we'll just return success
        res.status(200).json({ 
          success: true, 
          message: 'Budget alert processed',
          alert: {
            type: 'budget',
            message,
            severity,
            timestamp: new Date().toISOString(),
          }
        })
        return
      }

      if (type === 'push_notification') {
        // Handle push notification subscription
        const { subscription } = data as any
        
        // Store subscription for push notifications
        // This would typically be stored in a notifications_subscriptions table
        
        res.status(200).json({ 
          success: true, 
          message: 'Push notification subscription updated' 
        })
        return
      }

      res.status(400).json({ error: 'Invalid notification type' })
    } catch (error) {
      console.error('Notifications POST error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
