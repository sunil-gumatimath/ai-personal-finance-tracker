// Advanced AI Query Processor for Natural Language Financial Queries

type Timeframe = 'today' | 'week' | 'month' | 'last_month' | 'quarter' | 'year' | 'all' | 'custom'
type IntentType = 'comparison' | 'forecast' | 'income' | 'debt' | 'balance' | 'spending' | 'budget' | 'goals' | 'general'
type OperationType = 'total' | 'average' | 'count' | 'trend' | 'breakdown'
type ComparisonType = 'last_month' | 'last_year' | 'budget' | 'goal'

interface IntentResult {
  type: IntentType
  confidence: number
}

interface ProcessedIntent {
  type: IntentType
  timeframe: Timeframe | undefined
  categories: string[]
  operation: OperationType | undefined
  comparison: ComparisonType | undefined
  amount: number | undefined
}

interface ProcessedQuery {
  intent: ProcessedIntent
  originalQuery: string
  confidence: number
  suggestedResponse: string
}

class AIQueryProcessor {
  static TIMEFRAME_PATTERNS: Record<string, RegExp> = {
    'today': /today|now|current/i,
    'week': /this week|past week|last 7 days|past 7 days/i,
    'month': /this month|past month|last 30 days|past 30 days|monthly/i,
    'last_month': /last month|previous month/i,
    'quarter': /this quarter|past quarter|last 3 months|past 90 days/i,
    'year': /this year|past year|last 12 months|past 365 days|annually|yearly/i,
    'all': /all time|ever|total|overall|lifetime/i
  }

  static CATEGORY_PATTERNS: Record<string, RegExp> = {
    'food': /food|dining|restaurant|groceries|eating|meal/i,
    'transport': /transport|car|gas|fuel|uber|taxi|bus|train|metro/i,
    'shopping': /shopping|clothes|retail|amazon|purchase|buy/i,
    'entertainment': /entertainment|movie|netflix|spotify|games|fun/i,
    'bills': /bills|utilities|rent|mortgage|insurance|phone|internet/i,
    'health': /health|medical|doctor|pharmacy|gym|fitness/i,
    'education': /education|school|college|course|books|tuition/i
  }

  static INTENT_PATTERNS: Record<string, RegExp> = {
    'comparison': /compare|difference|change|versus|vs|than|income vs expenses|expenses vs income/i,
    'forecast': /forecast|predict|expect|project|future/i,
    'income': /income|earned|salary|wage|received|deposit|how much.*earn/i,
    'debt': /debt|loan|credit|owe|borrow|payment|how much.*debt/i,
    'balance': /balance|account|total|worth|net worth|how much.*have/i,
    'spending': /spend|spent|expense|cost|paid|bought/i,
    'budget': /budget|limit|allowance|cap|allocated/i,
    'goals': /goal|target|save|objective|aim/i
  }

  static OPERATION_PATTERNS: Record<string, RegExp> = {
    'total': /total|sum|overall|complete|grand total/i,
    'average': /average|mean|typical|usual|normal/i,
    'count': /count|number|how many|frequency/i,
    'trend': /trend|pattern|change|increase|decrease/i,
    'breakdown': /breakdown|split|by category|categor/i
  }

  static processQuery(query: string): ProcessedQuery {
    const normalizedQuery = query.toLowerCase().trim()
    
    // Determine intent
    const intent = this.determineIntent(normalizedQuery)
    
    // Extract timeframe
    const timeframe = this.extractTimeframe(normalizedQuery)
    
    // Extract categories
    const categories = this.extractCategories(normalizedQuery)
    
    // Extract operation
    const operation = this.extractOperation(normalizedQuery)
    
    // Extract comparison
    const comparison = this.extractComparison(normalizedQuery)
    
    // Extract amount
    const amount = this.extractAmount(normalizedQuery)

    const processedQuery: ProcessedQuery = {
      intent: {
        type: intent.type,
        timeframe,
        categories,
        operation,
        comparison,
        amount
      },
      originalQuery: query,
      confidence: intent.confidence,
      suggestedResponse: ''
    }

    // Add suggested response for common patterns
    processedQuery.suggestedResponse = this.generateSuggestedResponse(processedQuery)
    
    return processedQuery
  }

  static determineIntent(query: string): IntentResult {
    for (const [intentType, pattern] of Object.entries(this.INTENT_PATTERNS)) {
      if (pattern.test(query)) {
        return { type: intentType as IntentType, confidence: 0.9 }
      }
    }
    return { type: 'general', confidence: 0.3 }
  }

  static extractTimeframe(query: string): Timeframe | undefined {
    for (const [timeframe, pattern] of Object.entries(this.TIMEFRAME_PATTERNS)) {
      if (pattern.test(query)) {
        return timeframe as Timeframe
      }
    }
    
    // Check for specific date patterns
    if (/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(query)) {
      return 'custom'
    }
    
    return undefined
  }

  static extractCategories(query: string): string[] {
    const categories: string[] = []
    for (const [category, pattern] of Object.entries(this.CATEGORY_PATTERNS)) {
      if (pattern.test(query)) {
        categories.push(category)
      }
    }
    return categories
  }

  static extractOperation(query: string): OperationType | undefined {
    for (const [operation, pattern] of Object.entries(this.OPERATION_PATTERNS)) {
      if (pattern.test(query)) {
        return operation as OperationType
      }
    }
    return undefined
  }

  static extractComparison(query: string): ComparisonType | undefined {
    if (/last month|previous month|month over month/i.test(query)) {
      return 'last_month'
    }
    if (/last year|previous year|year over year/i.test(query)) {
      return 'last_year'
    }
    if (/budget|allocated|limit/i.test(query)) {
      return 'budget'
    }
    if (/goal|target|objective/i.test(query)) {
      return 'goal'
    }
    return undefined
  }

  static extractAmount(query: string): number | undefined {
    const amountMatch = query.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/)
    if (amountMatch) {
      return parseFloat(amountMatch[1].replace(/,/g, ''))
    }
    return undefined
  }

  static generateSuggestedResponse(processed: ProcessedQuery): string {
    const { intent } = processed
    
    // Generate contextual suggestions based on intent
    switch (intent.type) {
      case 'balance':
        return "I'll check your current account balances and calculate your total net worth."
      
      case 'spending':
        if (intent.categories?.length) {
          return `I'll analyze your ${intent.categories.join(' and ')} spending${intent.timeframe ? ` for ${intent.timeframe.replace('_', ' ')}` : ''}.`
        }
        return "I'll break down your spending patterns and show you where your money is going."
      
      case 'income':
        return "I'll review your income sources and calculate your earnings."
      
      case 'budget':
        return "I'll check your budget status and show you how you're tracking against your limits."
      
      case 'comparison':
        if (intent.comparison === 'last_month') {
          return "I'll compare this month's spending with last month to show you the changes."
        }
        return "I'll compare your income and expenses to show your financial picture."
      
      case 'forecast':
        return "Based on your spending patterns, I'll provide a financial forecast."
      
      case 'goals':
        return "I'll review your savings goals and show your progress toward each target."
      
      case 'debt':
        return "I'll analyze your debt situation and show your payment progress."
      
      default:
        return "I'll help you with that financial question using your data."
    }
  }
}

// Example query templates for users
const QUERY_EXAMPLES: string[] = [
  "How much did I spend on food last month?",
  "What's my total account balance?",
  "Show me my income vs expenses this month",
  "Compare my spending this month vs last month",
  "How much do I spend on transportation weekly?",
  "What's my average monthly grocery bill?",
  "Am I on track with my savings goals?",
  "Show me a breakdown of my entertainment spending",
  "How much debt do I have left?",
  "What's my net worth?",
  "Forecast my expenses for next month",
  "How much can I save this month?",
  "Which category do I spend the most on?",
  "What's my average daily spending?",
  "How much have I earned this year?",
  "Am I over budget on dining?",
  "When will I reach my savings goal?",
  "What's my financial health score?"
]

export { AIQueryProcessor, QUERY_EXAMPLES }
export type { ProcessedQuery, ProcessedIntent, IntentResult, Timeframe, IntentType, OperationType, ComparisonType }
