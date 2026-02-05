import { getAuthedUserId } from './_auth.js'
import { query } from './_db.js'
import { buildUpdateQuery, buildInsertQuery } from './_query-builder.js'
import type { ApiRequest, ApiResponse } from './_types.js'

const toDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type BudgetRow = {
  period: 'weekly' | 'monthly' | 'yearly'
  category_id: string
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Handle ID-based operations (PUT, DELETE)
  const id = req.query?.id
  if (id && typeof id === 'string') {
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      res.status(400).json({ error: 'Invalid budget ID format' })
      return
    }

    if (req.method === 'PUT') {
      try {
        const data = req.body || {}
        
        const queryData = buildUpdateQuery(
          'budgets',
          data,
          'id = $1 AND user_id = $2',
          [id, userId]
        )
        
        if (!queryData) {
          res.status(400).json({ error: 'No valid fields to update' })
          return
        }
        
        const { rows } = await query(queryData.text, queryData.values)
        if (rows.length === 0) {
          res.status(404).json({ error: 'Budget not found' })
          return
        }
        res.status(200).json({ budget: rows[0] })
      } catch (error) {
        console.error('Budgets PUT error:', error)
        if (error instanceof Error && error.message.includes('Invalid columns')) {
          res.status(400).json({ error: error.message })
          return
        }
        res.status(500).json({ error: 'Server error' })
      }
      return
    }

    if (req.method === 'DELETE') {
      try {
        await query('DELETE FROM budgets WHERE id = $1 AND user_id = $2', [id, userId])
        res.status(200).json({ ok: true })
      } catch (error) {
        console.error('Budgets DELETE error:', error)
        res.status(500).json({ error: 'Server error' })
      }
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Handle collection operations (GET, POST)
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

      const budgetsWithSpent = (budgetsRes.rows as BudgetRow[] || []).map((budget: BudgetRow) => {
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
      const categoryId = typeof data.category_id === 'string' ? data.category_id : ''
      const amount = typeof data.amount === 'number' ? data.amount : 0
      const period = typeof data.period === 'string' ? data.period : ''
      
      // Validate required fields
      if (!categoryId) {
        res.status(400).json({ error: 'Category is required' })
        return
      }
      if (amount <= 0) {
        res.status(400).json({ error: 'Valid budget amount is required' })
        return
      }
      if (!period || !['weekly', 'monthly', 'yearly'].includes(period)) {
        res.status(400).json({ error: 'Valid period is required (weekly, monthly, yearly)' })
        return
      }
      
      const queryData = buildInsertQuery('budgets', data, { user_id: userId })
      const { rows } = await query(queryData.text, queryData.values)
      res.status(201).json({ budget: rows[0] })
    } catch (error) {
      console.error('Budgets POST error:', error)
      if (error instanceof Error && error.message.includes('Invalid columns')) {
        res.status(400).json({ error: error.message })
        return
      }
      res.status(500).json({ error: 'Server error' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
