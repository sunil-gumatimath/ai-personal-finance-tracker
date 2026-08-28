import {
	generateWithKiloCode,
	streamWithKiloCode,
} from "./_ai_kilocode.js";

export {
	getFreeModelIds,
	isFreeModel,
	KiloCodeApiError,
} from "./_ai_kilocode.js";

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
	signal?: AbortSignal,
): Promise<string> {
	const key =
		prefs.kilocodeApiKey?.trim() || process.env.KILOCODE_API_KEY?.trim();
	if (!key) {
		throw new MissingApiKeyError(
			"KiloCode API key is not configured. Please add it in Settings > Preferences > AI Integration.",
		);
	}

	return generateWithKiloCode(prompt, key, prefs.kilocodeModel, options, signal);
}

/**
 * Streaming counterpart of generateWithProvider: resolves the API key,
 * enforces the free-model allowlist, then yields text deltas from the
 * gateway as they arrive.
 */
export async function* streamWithProvider(
	prompt: string,
	prefs: AIProviderPreferences,
	options?: { responseMimeType?: string },
	signal?: AbortSignal,
): AsyncGenerator<string> {
	const key =
		prefs.kilocodeApiKey?.trim() || process.env.KILOCODE_API_KEY?.trim();
	if (!key) {
		throw new MissingApiKeyError(
			"KiloCode API key is not configured. Please add it in Settings > Preferences > AI Integration.",
		);
	}

	yield* streamWithKiloCode(prompt, key, prefs.kilocodeModel, options, signal);
}

export class MissingApiKeyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MissingApiKeyError";
	}
}
