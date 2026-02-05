import { getAuthedUserId } from './_auth'
import { query } from './_db'

const toDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default async function handler(req: any, res: any) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (req.method === 'GET') {
    try {
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      const earliestStartDate = toDateString(startOfYear)

      const [budgetsRes, transactionsRes] = await Promise.all([
        query(
          `
          SELECT b.*, row_to_json(c.*) as category
          FROM budgets b
          LEFT JOIN categories c ON b.category_id = c.id
          WHERE b.user_id = $1
          `,
          [userId],
        ),
        query<{ amount: number; category_id: string; date: string }>(
          `
          SELECT amount, category_id, date
          FROM transactions
          WHERE user_id = $1 AND type = 'expense' AND date >= $2
          `,
          [userId, earliestStartDate],
        ),
      ])

      const transactionsByCategory = new Map<string, { amount: number; date: string }[]>()
      for (const t of transactionsRes.rows || []) {
        if (!t.category_id) continue
        const existing = transactionsByCategory.get(t.category_id) || []
        existing.push({ amount: t.amount, date: t.date })
        transactionsByCategory.set(t.category_id, existing)
      }

      const budgetsWithSpent = (budgetsRes.rows || []).map((budget: any) => {
        let startDateStr: string
        switch (budget.period) {
          case 'weekly':
            startDateStr = toDateString(startOfWeek)
            break
          case 'yearly':
            startDateStr = toDateString(startOfYear)
            break
          default:
            startDateStr = toDateString(startOfMonth)
        }

        const categoryTransactions = transactionsByCategory.get(budget.category_id) || []
        const spent = categoryTransactions
          .filter(t => t.date >= startDateStr)
          .reduce((sum, t) => sum + Number(t.amount || 0), 0)

        return { ...budget, spent }
      })

      res.status(200).json({ budgets: budgetsWithSpent })
    } catch (error) {
      console.error('Budgets GET error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const data = req.body || {}
      const keys = Object.keys(data).filter(k => k !== 'user_id')
      const values = keys.map(k => data[k])
      keys.push('user_id')
      values.push(userId)
      const columns = keys.join(', ')
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
      const text = `INSERT INTO budgets (${columns}) VALUES (${placeholders}) RETURNING *`
      const { rows } = await query(text, values)
      res.status(201).json({ budget: rows[0] })
    } catch (error) {
      console.error('Budgets POST error:', error)
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
