import { GoogleGenerativeAI } from '@google/generative-ai'

const DEFAULT_MODEL = 'gemini-3-flash-preview'

export async function generateFinancialAdvice(prompt: string, apiKey: string, modelName?: string) {
  const modelId = modelName || DEFAULT_MODEL
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: modelId })
  const result = await model.generateContent(prompt)
  const response = await result.response
  return response.text()
}
