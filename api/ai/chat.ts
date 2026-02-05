import { getAuthedUserId } from '../_auth.js'
import { query, queryOne } from '../_db.js'
import { generateFinancialAdvice } from '../_gemini.js'
import type { ApiRequest, ApiResponse } from '../_types.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { message } = req.body || {}
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' })
      return
    }

    const profile = await queryOne<{ preferences: Record<string, unknown> | null; currency: string | null }>(
      'SELECT preferences, currency FROM profiles WHERE user_id = $1',
      [userId],
    )

    const prefs = profile?.preferences || {}
    const apiKey = typeof prefs.geminiApiKey === 'string' ? prefs.geminiApiKey : undefined
    const currency = typeof prefs.currency === 'string' ? prefs.currency : (profile?.currency || 'USD')

    if (!apiKey) {
      res.status(400).json({ error: 'Gemini API key not set in preferences' })
      return
    }

    const { rows: recentTransactions } = await query(
      `
      SELECT t.type, t.amount, t.date, t.description, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1
      ORDER BY t.date DESC
      LIMIT 20
      `,
      [userId],
    )

    const { rows: accounts } = await query(
      `
      SELECT name, balance, type
      FROM accounts
      WHERE user_id = $1
      `,
      [userId],
    )

    const { rows: budgets } = await query(
      `
      SELECT b.amount, b.period, c.name as category_name
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = $1
      `,
      [userId],
    )

    const context = `
You are a helpful, friendly financial advisor assistant. The user is asking about their personal finances.

**IMPORTANT: Currency Setting**
The user's preferred currency is: ${currency}
ALWAYS format all monetary values using ${currency} symbol and format. For example:
- INR: ₹1,00,000 (Indian format with lakhs)
- USD: $100,000
- EUR: €100,000
- GBP: £100,000

**User's Financial Data:**
- Accounts: ${JSON.stringify(accounts || [])}
- Recent Transactions (last 20): ${JSON.stringify(recentTransactions || [])}
- Budgets: ${JSON.stringify(budgets || [])}

**User's Question:** ${message}

**Instructions:**
1. Be concise but helpful (keep responses under 150 words unless more detail is needed)
2. Use the actual data provided to give specific, personalized advice
3. ALWAYS format numbers in ${currency} - this is critical!
4. If asked about balance, calculate totals from the accounts data
5. Be encouraging and positive while being honest about financial health
6. Suggest actionable next steps when appropriate
7. DO NOT use any emojis in your responses.
    `

    const response = await generateFinancialAdvice(context, apiKey)
    res.status(200).json({ response })
  } catch (error) {
    console.error('AI chat error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}
