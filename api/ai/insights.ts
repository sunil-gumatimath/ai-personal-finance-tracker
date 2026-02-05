import { getAuthedUserId } from '../_auth.js'
import { query, queryOne } from '../_db.js'
import { generateFinancialAdvice } from '../_gemini.js'
import type { ApiRequest, ApiResponse } from '../_types.js'

type Insight = {
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Handle ID-based operations (PATCH for dismiss)
  const id = req.query?.id
  if (id && typeof id === 'string') {
    if (req.method === 'PATCH') {
      try {
        await query('UPDATE ai_insights SET is_dismissed = true WHERE id = $1 AND user_id = $2', [
          id,
          userId,
        ])
        res.status(200).json({ ok: true })
      } catch (error) {
        console.error('AI insight PATCH error:', error)
        res.status(500).json({ error: 'Server error' })
      }
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (req.method === 'GET') {
    try {
      const { rows } = await query<Insight>(
        `
        SELECT * FROM ai_insights
        WHERE user_id = $1
        AND is_dismissed = false
        AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        `,
        [userId],
      )
      res.status(200).json({ insights: rows })
    } catch (error) {
      console.error('AI insights GET error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const { forceRefresh } = req.body || {}
      if (!forceRefresh) {
        const { rows } = await query<Insight>(
          `
          SELECT * FROM ai_insights
          WHERE user_id = $1
          AND is_dismissed = false
          AND created_at > NOW() - INTERVAL '7 days'
          ORDER BY created_at DESC
          `,
          [userId],
        )
        if (rows.length > 0) {
          res.status(200).json({ insights: rows })
          return
        }
      }

      const profile = await queryOne<{ preferences: Record<string, unknown> | null; currency: string | null }>(
        'SELECT preferences, currency FROM profiles WHERE user_id = $1',
        [userId],
      )
      const prefs = profile?.preferences || {}
      const currency = typeof prefs.currency === 'string' ? prefs.currency : (profile?.currency || 'USD')
      const currencyLocales: Record<string, string> = {
        USD: 'en-US',
        INR: 'en-IN',
        EUR: 'de-DE',
        GBP: 'en-GB',
        JPY: 'ja-JP',
      }
      const formatCurrency = (amount: number) =>
        new Intl.NumberFormat(currencyLocales[currency] || 'en-US', {
          style: 'currency',
          currency,
        }).format(amount)
      const apiKey = typeof prefs.geminiApiKey === 'string' ? prefs.geminiApiKey : undefined

      type TransactionWithCategory = {
        type: string
        amount: number | string | null
        description: string | null
        date: string
        category: { name?: string } | null
      }

      const { rows: transactions } = await query<TransactionWithCategory>(
        `
        SELECT t.*, row_to_json(c.*) as category
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = $1
        AND t.date >= NOW() - INTERVAL '6 months'
        ORDER BY t.date DESC
        `,
        [userId],
      )

      const newInsights: Omit<Insight, 'id'>[] = []
      const categoryStats = new Map<string, { total: number; count: number; transactions: TransactionWithCategory[] }>()

      for (const t of transactions || []) {
        if (t.type === 'expense' && t.category) {
          const catName = t.category.name
          const stats = categoryStats.get(catName) || { total: 0, count: 0, transactions: [] }
          stats.total += Number(t.amount || 0)
          stats.count += 1
          stats.transactions.push(t)
          categoryStats.set(catName, stats)
        }
      }

      categoryStats.forEach((stats, catName) => {
        const average = stats.total / stats.count
        const recentTransactions = stats.transactions.slice(0, 3)
        recentTransactions.forEach(t => {
          const amount = Number(t.amount || 0)
          if (amount > average * 1.8 && amount > 50) {
            newInsights.push({
              type: 'anomaly',
              title: 'Unusual Spending',
              description: `You spent ${formatCurrency(amount)} on ${t.description || catName}, which is higher than your typical ${formatCurrency(average)} average.`,
              category: catName,
              amount,
              date: t.date,
            })
          }
        })
      })

      if (apiKey && transactions.length > 0) {
        const spendingSummary = Array.from(categoryStats.entries()).map(([cat, stats]) => {
          return { category: cat, average: stats.total / stats.count }
        })

        const prompt = `
I am a personal finance AI agent. Analyze the following spending data:
Currency: ${currency}
Category Stats: ${JSON.stringify(spendingSummary)}

Generate 2-3 specific, actionable financial insights focusing on:
- Spending shifts (Coaching)
- Success stories where spending decreased (Kudo)
- Actionable advice

Return ONLY a JSON array:
[{"type": "coaching" | "kudo", "title": "Title", "description": "Description"}]
No markdown, no extra text, and NO emojis.
        `

        try {
          const aiResponse = await generateFinancialAdvice(prompt, apiKey)
          if (aiResponse) {
            const cleaned = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim()
            const aiInsights = JSON.parse(cleaned) as Array<{
              type: 'coaching' | 'kudo'
              title: string
              description: string
            }>
            aiInsights.forEach(insight => {
              newInsights.push({ ...insight, type: insight.type })
            })
          }
        } catch (e) {
          console.error('Failed to generate AI insights:', e)
        }
      }

      if (newInsights.length === 0) {
        newInsights.push({
          type: 'coaching',
          title: 'Financial Health Tip',
          description: 'Try the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings.',
        })
      }

      const saved: Insight[] = []
      for (const insight of newInsights) {
        const { rows } = await query<Insight>(
          `
          INSERT INTO ai_insights (user_id, type, title, description, category, amount, date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
          `,
          [
            userId,
            insight.type,
            insight.title,
            insight.description,
            insight.category || null,
            insight.amount || null,
            insight.date || null,
          ],
        )
        if (rows[0]) saved.push(rows[0])
      }

      res.status(200).json({ insights: saved })
    } catch (error) {
      console.error('AI insights POST error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
