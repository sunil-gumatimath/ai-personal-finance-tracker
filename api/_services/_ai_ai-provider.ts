import {
	generateWithKiloCode,
	KiloCodeApiError,
	isFreeModel,
	getFreeModelIds,
} from "./_ai_kilocode.js";

export {
	FREE_MODELS,
	DEFAULT_MODEL,
	getFreeModelIds,
	isFreeModel,
	KiloCodeApiError,
} from "./_ai_kilocode.js";
export type { FreeModel } from "./_ai_kilocode.js";

export interface AIProviderPreferences {
	aiProvider?: string;
	kilocodeApiKey?: string;
	kilocodeModel?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
	kilocode: "KiloCode",
};

export function getProviderLabel(provider: string): string {
	return PROVIDER_LABELS[provider] || provider;
}

export async function generateWithProvider(
	prompt: string,
	prefs: AIProviderPreferences,
	options?: { responseMimeType?: string },
): Promise<string> {
	const key =
		prefs.kilocodeApiKey?.trim() || process.env.KILOCODE_API_KEY?.trim();
	if (!key) {
		throw new MissingApiKeyError(
			"KiloCode API key is not configured. Please add it in Settings > Preferences > AI Integration.",
		);
	}

	// Only free models are allowed. An empty model falls back to the default.
	if (prefs.kilocodeModel && !isFreeModel(prefs.kilocodeModel)) {
		throw new KiloCodeApiError(
			`Model "${prefs.kilocodeModel.trim()}" is not in the free model list. Allowed models: ${getFreeModelIds().join(", ")}`,
			400,
		);
	}

	return generateWithKiloCode(prompt, key, prefs.kilocodeModel, options);
}

export class MissingApiKeyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MissingApiKeyError";
	}
}
