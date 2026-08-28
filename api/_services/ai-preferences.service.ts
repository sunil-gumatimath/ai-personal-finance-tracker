import { queryOne } from "../_repositories/db.js";
import { decryptPreferences } from "../_utils/crypto.js";
import {
	getProviderLabel,
	type AIProviderPreferences,
} from "./_ai_ai-provider.js";
import { DEFAULT_CURRENCY } from "../_config/server-config.js";

export interface ResolvedAiPreferences {
	prefs: AIProviderPreferences;
	currency: string;
	hasKey: boolean;
	providerLabel: string;
}

/**
 * Resolve the user's AI preferences (decrypted), currency, and key presence
 * in one place. `requestPrefs` may carry a provider override from the client
 * (model overrides are intentionally NOT copied here — they are validated
 * against the free-model allowlist by the caller/generateWithProvider).
 */
export async function resolveAiPreferences(
	userId: string,
	requestPrefs?: Record<string, unknown>,
): Promise<ResolvedAiPreferences> {
	const profile = await queryOne<{
		preferences: Record<string, unknown> | null;
		currency: string | null;
	}>("SELECT preferences, currency FROM profiles WHERE user_id = $1", [userId]);

	// Only "kilocode" is supported today; the provider layer unconditionally
	// dispatches to KiloCode, so any other value would be silently ignored
	// downstream (M9). Coerce to the default instead of persisting an unknown
	// provider that looks configured but does nothing.
	const allowedRequestPrefs: Record<string, unknown> = {};
	if (
		requestPrefs &&
		requestPrefs["aiProvider"] === "kilocode"
	) {
		allowedRequestPrefs["aiProvider"] = "kilocode";
	}

	const decrypted = decryptPreferences(profile?.preferences || {}) || {};
	const prefs = {
		...decrypted,
		...allowedRequestPrefs,
	} as AIProviderPreferences;

	const currency =
		typeof decrypted["currency"] === "string"
			? (decrypted["currency"] as string)
			: profile?.currency || DEFAULT_CURRENCY;

	const hasKey =
		typeof prefs.kilocodeApiKey === "string" && prefs.kilocodeApiKey.length > 0;

	return {
		prefs,
		currency,
		hasKey: hasKey || Boolean(process.env.KILOCODE_API_KEY?.trim()),
		providerLabel: getProviderLabel(prefs.aiProvider || "kilocode"),
	};
}
