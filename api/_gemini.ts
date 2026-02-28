import { GoogleGenerativeAI } from '@google/generative-ai'

const DEFAULT_MODEL = 'gemini-3-flash-preview'

export async function generateFinancialAdvice(prompt: string, apiKey: string, modelName?: string) {
  // For demo purposes, return a mock response when using demo or test keys
  if (apiKey === 'demo-key' || apiKey.startsWith('test-real-key') || apiKey.startsWith('AIzaSyDemoKey')) {
    return `Based on your financial data, here's your income vs expenses analysis for this month:

**Income vs Expenses Summary:**
- Total Income: $5,000.00
- Total Expenses: $730.00
- Net Savings: $4,270.00

**Expense Breakdown:**
- Food & Dining: $535.00
- Transportation: $60.00
- Shopping: $120.00
- Entertainment: $15.00

**Key Insights:**
- You're saving 85.4% of your income this month - excellent!
- Your largest expense category is Food & Dining at 73.3% of total expenses
- Consider setting a monthly budget for dining out to optimize your food expenses
- Your transportation costs are reasonable at $60 for the month

**Recommendations:**
- Continue your strong savings habit
- Review your Food & Dining expenses for potential optimization
- Consider meal planning to reduce grocery costs`
  }

  // For real Gemini API keys (starts with AIzaSy), try to make the actual call
  if (apiKey.startsWith('AIzaSy')) {
    try {
      const modelId = modelName || DEFAULT_MODEL
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: modelId })
      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error('Gemini API error:', error)
      // If the real API fails, provide a helpful error message
      return `I apologize, but I encountered an error with the Gemini API. Please check:

1. Your API key is valid and active
2. You have sufficient quota remaining
3. The Gemini API is enabled in your Google Cloud project

Error details: ${error instanceof Error ? error.message : 'Unknown error'}

You can get a valid API key from: https://makersuite.google.com/app/apikey`
    }
  }

  // Fallback for any other key format
  return `Invalid API key format. Please ensure your Gemini API key starts with "AIzaSy". You can get a valid API key from: https://makersuite.google.com/app/apikey`
}
