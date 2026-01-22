import { GoogleGenerativeAI } from '@google/generative-ai'

const DEFAULT_MODEL = 'gemini-1.5-flash'

export const generateFinancialAdvice = async (prompt: string, apiKey?: string, modelName?: string) => {
    const key = apiKey
    const modelId = modelName || DEFAULT_MODEL

    if (!key) {
        console.warn('Gemini API Key is missing. Please provide it in Settings.')
        return null
    }

    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
        model: modelId,
    })

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
}
