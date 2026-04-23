import { getAuthedUserId } from '../_auth.js'
import { query, queryOne } from '../_db.js'
import { generateFinancialAdvice } from '../_gemini.js'
import type { ApiRequest, ApiResponse } from '../_types.js'
// @ts-expect-error - JavaScript module
import { AIQueryProcessor } from './query-processor.js'

type IntentType =
  | 'comparison'
  | 'forecast'
  | 'income'
  | 'debt'
  | 'balance'
  | 'spending'
  | 'budget'
  | 'goals'
  | 'general'

interface ProcessedIntent {
  type: IntentType
  timeframe?: string
  categories?: string[]
  operation?: string
  comparison?: string
  amount?: number
}

interface ProcessedQuery {
  intent: ProcessedIntent
  originalQuery: string
  confidence: number
  suggestedResponse: string
}

interface AccountRow {
  name: string
  balance: number | string
  type: string
}

interface TransactionRow {
  type: 'income' | 'expense'
  amount: number | string
  date: string
  description: string | null
  category_name: string | null
}

interface BudgetRow {
  amount: number | string
  period: string
  category_name: string | null
}

interface GoalRow {
  name: string
  target_amount: number | string
  current_amount: number | string
  deadline: string | null
}

interface DebtRow {
  name: string
  current_balance: number | string
  interest_rate: number | string
  minimum_payment: number | string
}

interface FinancialData {
  accounts: AccountRow[]
  transactions: TransactionRow[]
  budgets: BudgetRow[]
  goals: GoalRow[]
  debts: DebtRow[]
}

interface AIQueryProcessorContract {
  processQuery: (query: string) => ProcessedQuery
}

const queryProcessor = AIQueryProcessor as AIQueryProcessorContract

// Helper function to fetch relevant financial data based on query intent
async function fetchFinancialData(userId: string, intent: ProcessedIntent) {
  try {
    const timeframeCondition = getTimeframeCondition(intent.timeframe)

    const data: FinancialData = {
      accounts: [],
      transactions: [],
      budgets: [],
      goals: [],
      debts: [],
    }

    // Always get basic account info
    const { rows: accounts } = await query<AccountRow>(
      'SELECT name, balance, type FROM accounts WHERE user_id = $1',
      [userId],
    )
    data.accounts = accounts || []

    // Fetch transactions based on intent
    const categoryCondition = intent.categories?.length ? 'AND c.name = ANY($2)' : ''
    const transactionQuery = `
      SELECT t.type, t.amount, t.date, t.description, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1 ${timeframeCondition} ${categoryCondition}
      ORDER BY t.date DESC
    `

    const queryParams: unknown[] = [userId]
    if (intent.categories?.length) {
      queryParams.push(intent.categories)
    }

    const { rows: transactions } = await query<TransactionRow>(transactionQuery, queryParams)
    data.transactions = transactions || []

    // Get budgets for spending/budget queries
    if (['spending', 'budget', 'comparison'].includes(intent.type)) {
      const { rows: budgets } = await query<BudgetRow>(
        `SELECT b.amount, b.period, c.name as category_name
         FROM budgets b
         LEFT JOIN categories c ON b.category_id = c.id
         WHERE b.user_id = $1`,
        [userId],
      )
      data.budgets = budgets || []
    }

    // Get goals for goal-related queries
    if (['goals', 'forecast'].includes(intent.type)) {
      const { rows: goals } = await query<GoalRow>(
        'SELECT name, target_amount, current_amount, deadline FROM goals WHERE user_id = $1',
        [userId],
      )
      data.goals = goals || []
    }

    // Get debts for debt-related queries
    if (['debt', 'forecast'].includes(intent.type)) {
      const { rows: debts } = await query<DebtRow>(
        'SELECT name, current_balance, interest_rate, minimum_payment FROM debts WHERE user_id = $1 AND is_active = true',
        [userId],
      )
      data.debts = debts || []
    }

    return formatFinancialData(data, intent, 'USD') // Default to USD, will be overridden
  } catch (error) {
    console.error('Error fetching financial data:', error)
    // Return basic formatted data even if database queries fail
    return formatFinancialData(
      { accounts: [], transactions: [], budgets: [], goals: [], debts: [] },
      intent,
      'USD',
    )
  }
}

function getTimeframeCondition(timeframe?: string) {
  switch (timeframe) {
    case 'today':
      return 'AND DATE(t.date) = CURRENT_DATE'
    case 'week':
      return "AND t.date >= CURRENT_DATE - INTERVAL '7 days'"
    case 'month':
      return "AND t.date >= DATE_TRUNC('month', CURRENT_DATE)"
    case 'last_month':
      return "AND t.date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND t.date < DATE_TRUNC('month', CURRENT_DATE)"
    case 'quarter':
      return "AND t.date >= CURRENT_DATE - INTERVAL '3 months'"
    case 'year':
      return "AND t.date >= DATE_TRUNC('year', CURRENT_DATE)"
    case 'all':
    default:
      return ''
  }
}

function formatFinancialData(data: FinancialData, intent: ProcessedIntent, currency: string) {
  let formatted = `**Account Balances:**\n`
  if (data.accounts.length) {
    const totalBalance = data.accounts.reduce(
      (sum, acc) => sum + Number(acc.balance || 0),
      0,
    )
    formatted += `- Total Balance: ${formatCurrency(totalBalance, currency)}\n`
    data.accounts.forEach((acc) => {
      formatted += `- ${acc.name}: ${formatCurrency(Number(acc.balance || 0), currency)}\n`
    })
  }

  if (data.transactions.length && ['spending', 'income', 'comparison'].includes(intent.type)) {
    formatted += `\n**Recent Transactions:**\n`
    const income = data.transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const expenses = data.transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    if (intent.type === 'comparison') {
      formatted += `- Total Income: ${formatCurrency(income, currency)}\n`
      formatted += `- Total Expenses: ${formatCurrency(expenses, currency)}\n`
      formatted += `- Net Savings: ${formatCurrency(income - expenses, currency)}\n`
      if (intent.categories?.length) {
        const categorySpending: Record<string, number> = {}
        data.transactions.forEach((t) => {
          if (t.type === 'expense' && t.category_name) {
            categorySpending[t.category_name] =
              (categorySpending[t.category_name] || 0) + Number(t.amount || 0)
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
        data.transactions.forEach((t) => {
          if (t.type === 'expense' && t.category_name) {
            categorySpending[t.category_name] =
              (categorySpending[t.category_name] || 0) + Number(t.amount || 0)
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

  if (data.budgets.length && ['budget', 'spending'].includes(intent.type)) {
    formatted += `\n**Budgets:**\n`
    data.budgets.forEach((budget) => {
      formatted += `- ${budget.category_name}: ${formatCurrency(Number(budget.amount || 0), currency)} (${budget.period})\n`
    })
  }

  if (data.goals.length && ['goals', 'forecast'].includes(intent.type)) {
    formatted += `\n**Savings Goals:**\n`
    data.goals.forEach((goal) => {
      const progress = (Number(goal.current_amount || 0) / Number(goal.target_amount || 1)) * 100
      formatted += `- ${goal.name}: ${formatCurrency(Number(goal.current_amount || 0), currency)} / ${formatCurrency(Number(goal.target_amount || 0), currency)} (${progress.toFixed(1)}%)\n`
    })
  }

  if (data.debts.length && ['debt', 'forecast'].includes(intent.type)) {
    formatted += `\n**Debts:**\n`
    data.debts.forEach((debt) => {
      formatted += `- ${debt.name}: ${formatCurrency(Number(debt.current_balance || 0), currency)} at ${Number(debt.interest_rate || 0)}%\n`
    })
  }

  return formatted
}

function formatCurrency(amount: number, currency: string) {
  const formatters = {
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
    GBP: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
    INR: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }),
    JPY: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }),
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
    const processedQuery = queryProcessor.processQuery(message)
    console.log('Processed query:', processedQuery)

    const profile = await queryOne<{ preferences: Record<string, unknown> | null; currency: string | null }>(
      'SELECT preferences, currency FROM profiles WHERE user_id = $1',
      [userId],
    )

    const prefs = profile?.preferences || {}
    const apiKey = typeof prefs.geminiApiKey === 'string' ? prefs.geminiApiKey : undefined
    const modelName = typeof prefs.geminiModel === 'string' ? prefs.geminiModel : undefined
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

    const response = await generateFinancialAdvice(context, apiKey, modelName)
    res.status(200).json({
      response,
      processedQuery: {
        intent: processedQuery.intent.type,
        confidence: processedQuery.confidence,
        suggestedResponse: processedQuery.suggestedResponse,
      },
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
        res.status(500).json({ error: 'An internal server error occurred. Please try again later.' })
      }
    } else {
      res.status(500).json({ error: 'Unknown server error occurred.' })
    }
  }
}
