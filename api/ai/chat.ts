import { getAuthedUserId } from '../_auth.js'
import { query, queryOne } from '../_db.js'
import { generateFinancialAdvice } from '../_gemini.js'
import type { ApiRequest, ApiResponse } from '../_types.js'
// @ts-ignore - JavaScript module
import { AIQueryProcessor, QUERY_EXAMPLES } from './query-processor.js'

// Helper function to fetch relevant financial data based on query intent
async function fetchFinancialData(userId: string, intent: any) {
  try {
    const timeframeCondition = getTimeframeCondition(intent.timeframe)
    const categoryCondition = intent.categories?.length ? `AND c.name IN (${intent.categories.map(() => '?').join(',')})` : ''
    
    let data: any = {}

    // Always get basic account info
    const { rows: accounts } = await query(
      'SELECT name, balance, type FROM accounts WHERE user_id = $1',
      [userId]
    )
    data.accounts = accounts || []

    // Fetch transactions based on intent
    let transactionQuery = `
      SELECT t.type, t.amount, t.date, t.description, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1 ${timeframeCondition} ${categoryCondition}
      ORDER BY t.date DESC
    `
    
    const queryParams = [userId]
    if (intent.timeframe && intent.timeframe !== 'all') {
      queryParams.push(getTimeframeDate(intent.timeframe))
    }
    if (intent.categories?.length) {
      queryParams.push(...intent.categories)
    }

    const { rows: transactions } = await query(transactionQuery, queryParams)
    data.transactions = transactions || []

    // Get budgets for spending/budget queries
    if (['spending', 'budget', 'comparison'].includes(intent.type)) {
      const { rows: budgets } = await query(
        `SELECT b.amount, b.period, c.name as category_name
         FROM budgets b
         LEFT JOIN categories c ON b.category_id = c.id
         WHERE b.user_id = $1`,
        [userId]
      )
      data.budgets = budgets || []
    }

    // Get goals for goal-related queries
    if (['goals', 'forecast'].includes(intent.type)) {
      const { rows: goals } = await query(
        `SELECT name, target_amount, current_amount, deadline FROM goals WHERE user_id = $1`,
        [userId]
      )
      data.goals = goals || []
    }

    // Get debts for debt-related queries
    if (['debt', 'forecast'].includes(intent.type)) {
      const { rows: debts } = await query(
        `SELECT name, current_balance, interest_rate, minimum_payment FROM debts WHERE user_id = $1 AND is_active = true`,
        [userId]
      )
      data.debts = debts || []
    }

    return formatFinancialData(data, intent, 'USD') // Default to USD, will be overridden
  } catch (error) {
    console.error('Error fetching financial data:', error)
    // Return basic formatted data even if database queries fail
    return formatFinancialData({ accounts: [], transactions: [], budgets: [], goals: [], debts: [] }, intent, 'USD')
  }
}

function getTimeframeCondition(timeframe?: string) {
  switch (timeframe) {
    case 'today':
      return 'AND DATE(t.date) = CURRENT_DATE'
    case 'week':
      return 'AND t.date >= CURRENT_DATE - INTERVAL \'7 days\''
    case 'month':
      return 'AND t.date >= DATE_TRUNC(\'month\', CURRENT_DATE)'
    case 'last_month':
      return 'AND t.date >= DATE_TRUNC(\'month\', CURRENT_DATE - INTERVAL \'1 month\') AND t.date < DATE_TRUNC(\'month\', CURRENT_DATE)'
    case 'quarter':
      return 'AND t.date >= CURRENT_DATE - INTERVAL \'3 months\''
    case 'year':
      return 'AND t.date >= DATE_TRUNC(\'year\', CURRENT_DATE)'
    case 'all':
    default:
      return ''
  }
}

function getTimeframeDate(timeframe: string) {
  switch (timeframe) {
    case 'week':
      return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    case 'month':
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    case 'last_month':
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    case 'quarter':
      return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    case 'year':
      return new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    default:
      return new Date().toISOString().split('T')[0]
  }
}

function formatFinancialData(data: any, intent: any, currency: string) {
  let formatted = `**Account Balances:**\n`
  if (data.accounts?.length) {
    const totalBalance = data.accounts.reduce((sum: number, acc: any) => sum + Number(acc.balance || 0), 0)
    formatted += `- Total Balance: ${formatCurrency(totalBalance, currency)}\n`
    data.accounts.forEach((acc: any) => {
      formatted += `- ${acc.name}: ${formatCurrency(acc.balance, currency)}\n`
    })
  }

  if (data.transactions?.length && ['spending', 'income', 'comparison'].includes(intent.type)) {
    formatted += `\n**Recent Transactions:**\n`
    const income = data.transactions.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
    const expenses = data.transactions.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
    
    if (intent.type === 'comparison') {
      formatted += `- Total Income: ${formatCurrency(income, currency)}\n`
      formatted += `- Total Expenses: ${formatCurrency(expenses, currency)}\n`
      formatted += `- Net Savings: ${formatCurrency(income - expenses, currency)}\n`
      if (intent.categories?.length) {
        const categorySpending: Record<string, number> = {}
        data.transactions.forEach((t: any) => {
          if (t.type === 'expense' && t.category_name) {
            categorySpending[t.category_name] = (categorySpending[t.category_name] || 0) + Number(t.amount || 0)
          }
        })
        Object.entries(categorySpending).forEach(([cat, amount]) => {
          formatted += `- ${cat}: ${formatCurrency(amount, currency)}\n`
        })
      }
    }
    
    if (intent.type === 'spending') {
      formatted += `- Total Expenses: ${formatCurrency(expenses, currency)}\n`
      if (intent.categories?.length) {
        const categorySpending: Record<string, number> = {}
        data.transactions.forEach((t: any) => {
          if (t.type === 'expense' && t.category_name) {
            categorySpending[t.category_name] = (categorySpending[t.category_name] || 0) + Number(t.amount || 0)
          }
        })
        Object.entries(categorySpending).forEach(([cat, amount]) => {
          formatted += `- ${cat}: ${formatCurrency(amount, currency)}\n`
        })
      }
    }
    
    if (intent.type === 'income') {
      formatted += `- Total Income: ${formatCurrency(income, currency)}\n`
    }
  }

  if (data.budgets?.length && ['budget', 'spending'].includes(intent.type)) {
    formatted += `\n**Budgets:**\n`
    data.budgets.forEach((budget: any) => {
      formatted += `- ${budget.category_name}: ${formatCurrency(budget.amount, currency)} (${budget.period})\n`
    })
  }

  if (data.goals?.length && ['goals', 'forecast'].includes(intent.type)) {
    formatted += `\n**Savings Goals:**\n`
    data.goals.forEach((goal: any) => {
      const progress = (Number(goal.current_amount || 0) / Number(goal.target_amount)) * 100
      formatted += `- ${goal.name}: ${formatCurrency(goal.current_amount, currency)} / ${formatCurrency(goal.target_amount, currency)} (${progress.toFixed(1)}%)\n`
    })
  }

  if (data.debts?.length && ['debt', 'forecast'].includes(intent.type)) {
    formatted += `\n**Debts:**\n`
    data.debts.forEach((debt: any) => {
      formatted += `- ${debt.name}: ${formatCurrency(debt.current_balance, currency)} at ${debt.interest_rate}%\n`
    })
  }

  return formatted
}

function formatCurrency(amount: number, currency: string) {
  const formatters = {
    'USD': new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    'EUR': new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
    'GBP': new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
    'INR': new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }),
    'JPY': new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' })
  }
  return formatters[currency as keyof typeof formatters]?.format(amount) || `$${amount.toFixed(2)}`
}

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

    // Process the query using advanced NLP
    const processedQuery = AIQueryProcessor.processQuery(message)
    console.log('Processed query:', processedQuery)

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

    // Fetch comprehensive data based on query intent
    const financialData = await fetchFinancialData(userId, processedQuery.intent)

    const context = `
You are a highly intelligent financial advisor assistant with advanced natural language understanding capabilities.

**Query Analysis:**
- Original Question: "${message}"
- Detected Intent: ${processedQuery.intent.type}
- Timeframe: ${processedQuery.intent.timeframe || 'not specified'}
- Categories: ${processedQuery.intent.categories?.join(', ') || 'all categories'}
- Operation: ${processedQuery.intent.operation || 'general inquiry'}
- Confidence: ${Math.round(processedQuery.confidence * 100)}%

**IMPORTANT: Currency Setting**
The user's preferred currency is: ${currency}
ALWAYS format all monetary values using ${currency} symbol and proper formatting. For example:
- INR: ₹1,00,000 (Indian format with lakhs)
- USD: $100,000
- EUR: €100,000
- GBP: £100,000

**User's Financial Data:**
${financialData}

**Advanced Instructions:**
1. Be conversational and natural - respond like a knowledgeable financial advisor
2. Use the processed intent to provide highly relevant, specific answers
3. Reference actual data points from their financial records
4. If the query is about specific categories, focus your analysis there
5. For comparisons, provide clear before/after insights
6. For forecasts, use historical patterns to make educated predictions
7. Keep responses concise but comprehensive (under 200 words unless detailed analysis is needed)
8. Suggest actionable next steps based on their specific situation
9. If confidence is low (< 60%), ask for clarification
10. Use formatting (bold, lists) to improve readability
11. NEVER use emojis in professional responses

**User's Question:** ${message}

**Suggested Approach:** ${processedQuery.suggestedResponse}
`

    const response = await generateFinancialAdvice(context, apiKey)
    res.status(200).json({ 
      response,
      processedQuery: {
        intent: processedQuery.intent.type,
        confidence: processedQuery.confidence,
        suggestedResponse: processedQuery.suggestedResponse
      }
    })
  } catch (error) {
    console.error('AI chat error:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message === 'MOCK_MODE') {
        res.status(503).json({ error: 'Database not configured. Please set NEON_DATABASE_URL environment variable.' })
      } else if (error.message.includes('API key')) {
        res.status(400).json({ error: 'Invalid API key configuration.' })
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        res.status(503).json({ error: 'External service unavailable. Please try again later.' })
      } else {
        res.status(500).json({ error: `Server error: ${error.message}` })
      }
    } else {
      res.status(500).json({ error: 'Unknown server error occurred.' })
    }
  }
}
