import { generateFinancialAdvice as geminiGenerate } from "./_gemini.js";
import { generateWithOpenRouter } from "./_provider-openrouter.js";

export interface AIProviderPreferences {
  aiProvider?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

export function getProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] || provider;
}

export async function generateFinancialAdvice(
  prompt: string,
  apiKey: string,
  modelName?: string,
): Promise<string> {
  return geminiGenerate(prompt, apiKey, modelName);
}

export async function generateWithProvider(
  prompt: string,
  prefs: AIProviderPreferences,
): Promise<string> {
  const provider = prefs.aiProvider || "gemini";

  switch (provider) {
    case "openrouter": {
      const key = prefs.openrouterApiKey?.trim();
      if (!key) {
        throw new MissingApiKeyError(
          "OpenRouter API key is not configured. Please add it in Settings > Preferences > AI Integration.",
        );
      }
      if (key !== "demo-key" && !key.startsWith("sk-or-")) {
        throw new MissingApiKeyError(
          'OpenRouter API key appears invalid. OpenRouter keys usually start with "sk-or-". Please paste your OpenRouter key in Settings > Preferences > AI Integration.',
        );
      }
      return generateWithOpenRouter(
        prompt,
        key,
        prefs.openrouterModel || "openrouter/free",
      );
    }
    case "gemini":
    default: {
      const key = prefs.geminiApiKey?.trim();
      if (!key) {
        throw new MissingApiKeyError(
          "Gemini API key is not configured. Please add it in Settings > Preferences > AI Integration.",
        );
      }
      if (
        key !== "demo-key" &&
        !key.startsWith("test-real-key") &&
        !key.startsWith("AIza")
      ) {
        throw new MissingApiKeyError(
          'Gemini API key appears invalid. Gemini keys usually start with "AIza". Please paste your Gemini key in Settings > Preferences > AI Integration.',
        );
      }
      return geminiGenerate(prompt, key, prefs.geminiModel);
    }
  }
}

export class MissingApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingApiKeyError";
  }
}
