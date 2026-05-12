const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openrouter/free";
const FREE_ROUTER_FALLBACK_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const SITE_URL = "https://personal-finance-tracker.vercel.app";
const SITE_NAME = "AI Personal Finance Tracker";

function normalizeOpenRouterModel(modelName?: string): string {
  const model = modelName?.trim();

  if (!model || model === "free") {
    return DEFAULT_MODEL;
  }

  // Common typo fallback: "openroter/free" -> "openrouter/free"
  if (model.toLowerCase() === "openroter/free") {
    return DEFAULT_MODEL;
  }

  return model;
}

function isFreeRouterModel(model: string): boolean {
  return model === DEFAULT_MODEL;
}

async function callOpenRouter(prompt: string, apiKey: string, model: string) {
  return fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": SITE_URL,
      "X-Title": SITE_NAME,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2048,
    }),
  });
}

function formatOpenRouterError(
  status: number,
  errorBody: string,
  model: string,
) {
  let errorMessage = `OpenRouter API error (${status}) while using model "${model}".`;

  if (status === 400) {
    errorMessage = `OpenRouter rejected model "${model}". Please verify the model slug in Settings > Preferences > AI Integration.`;
  } else if (status === 401) {
    errorMessage =
      "Invalid OpenRouter API key. Please check your key in Settings > Preferences > AI Integration.";
  } else if (status === 402) {
    errorMessage =
      "OpenRouter account has insufficient credits. Please add credits to your OpenRouter account.";
  } else if (status === 429) {
    errorMessage = "OpenRouter rate limit exceeded. Please try again later.";
  } else if (status === 503) {
    errorMessage =
      "OpenRouter service is temporarily unavailable. Please try again later.";
  }

  const details = errorBody.trim().slice(0, 500);
  return details
    ? `I encountered an error with OpenRouter. ${errorMessage}\n\nDetails: ${details}`
    : `I encountered an error with OpenRouter. ${errorMessage}`;
}

export async function generateWithOpenRouter(
  prompt: string,
  apiKey: string,
  modelName?: string,
): Promise<string> {
  if (apiKey === "demo-key" || apiKey.startsWith("sk-or-demo-")) {
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
- Consider meal planning to reduce grocery costs`;
  }

  const model = normalizeOpenRouterModel(modelName);

  try {
    let response = await callOpenRouter(prompt, apiKey, model);

    if (!response.ok && isFreeRouterModel(model)) {
      const freeRouterError = await response.text();
      console.error(
        "OpenRouter free router error:",
        response.status,
        freeRouterError,
      );

      // If OpenRouter's random free router is unavailable, retry with a concrete free model.
      response = await callOpenRouter(
        prompt,
        apiKey,
        FREE_ROUTER_FALLBACK_MODEL,
      );

      if (!response.ok) {
        const fallbackError = await response.text();
        console.error(
          "OpenRouter fallback free model error:",
          response.status,
          fallbackError,
        );
        return formatOpenRouterError(
          response.status,
          fallbackError,
          FREE_ROUTER_FALLBACK_MODEL,
        );
      }
    } else if (!response.ok) {
      const errorBody = await response.text();
      console.error("OpenRouter API error:", response.status, errorBody);
      return formatOpenRouterError(response.status, errorBody, model);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return "I received an empty response from the AI model. Please try rephrasing your question or choose a different OpenRouter model in Settings.";
    }

    return content;
  } catch (error) {
    console.error("OpenRouter request error:", error);
    return `I encountered an error while connecting to OpenRouter. Please check your internet connection and try again. Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
