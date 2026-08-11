const KILOCODE_BASE_URL = "https://api.kilo.ai/api/gateway/v1";

/**
 * Upper bound for a single KiloCode request; a hang must not block the server.
 * Kept at 60s — free-tier reasoning models can be slow. On Vercel the
 * function's maxDuration (api/handler.ts) enforces the same ceiling.
 */
const REQUEST_TIMEOUT_MS = 60_000;

export interface FreeModel {
	id: string;
	label: string;
	context: string;
	description: string;
}

/**
 * Snapshot of the Kilo Gateway's $0-priced ("free") models, from Kilo's live
 * free-models catalog (kilo.ai/landing/free-models). The catalog changes over
 * time — when it does, update this list or set the KILOCODE_FREE_MODELS env
 * var (comma-separated model IDs) to override it without code changes.
 */
export const FREE_MODELS: FreeModel[] = [
	{
		id: "nvidia/nemotron-3-ultra-550b-a55b:free",
		label: "Nemotron 3 Ultra (Free)",
		context: "1M",
		description:
			"NVIDIA flagship reasoning model — the strongest general-purpose option for financial Q&A.",
	},
	{
		id: "nvidia/nemotron-3-super-120b-a12b:free",
		label: "Nemotron 3 Super (Free)",
		context: "262K",
		description: "NVIDIA hybrid MoE reasoning model.",
	},
	{
		id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
		label: "Nemotron 3 Nano Omni (Free)",
		context: "256K",
		description: "Fast NVIDIA vision + reasoning model.",
	},
	{
		id: "inclusionai/ling-3.0-flash:free",
		label: "Ling 3.0 Flash (Free)",
		context: "262K",
		description: "Newest free listing — token-efficient MoE, fast responses.",
	},
	{
		id: "stepfun/step-3.7-flash:free",
		label: "Step 3.7 Flash (Free)",
		context: "262K",
		description: "StepFun chat model.",
	},
	{
		id: "cohere/north-mini-code:free",
		label: "North Mini Code (Free)",
		context: "256K",
		description: "Cohere compact coding model.",
	},
	{
		id: "poolside/laguna-s-2.1:free",
		label: "Laguna S 2.1 (Free)",
		context: "262K",
		description: "Poolside coding agent model.",
	},
	{
		id: "poolside/laguna-xs-2.1:free",
		label: "Laguna XS 2.1 (Free)",
		context: "262K",
		description: "Lightweight Poolside model.",
	},
	{
		id: "tencent/hy3:free",
		label: "Hy3 (Free)",
		context: "262K",
		description: "Tencent chat model.",
	},
	{
		id: "nvidia/nemotron-3.5-content-safety:free",
		label: "Nemotron 3.5 Content Safety (Free)",
		context: "128K",
		description: "NVIDIA content-safety tuned model.",
	},
];

export const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

/** Allowed model IDs: the curated free list, overridable via env var. */
export function getFreeModelIds(): string[] {
	const override = process.env.KILOCODE_FREE_MODELS?.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (override && override.length > 0) return override;
	return FREE_MODELS.map((m) => m.id);
}

/** True when the model is unset (server default) or on the free allowlist. */
export function isFreeModel(model: string | undefined | null): boolean {
	if (!model || !model.trim()) return true;
	const id = model.trim().toLowerCase();
	return getFreeModelIds().some((m) => m.toLowerCase() === id);
}

/** Error carrying an HTTP status suitable for the API response. */
export class KiloCodeApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "KiloCodeApiError";
	}
}

async function callKiloCode(
	prompt: string,
	apiKey: string,
	model: string,
	options?: { responseMimeType?: string },
): Promise<Response> {
	return fetch(`${KILOCODE_BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
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
			response_format:
				options?.responseMimeType === "application/json"
					? { type: "json_object" }
					: undefined,
		}),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
}

function formatKiloCodeError(status: number, errorBody: string, model: string) {
	let errorMessage = `KiloCode API error (${status}) while using model "${model}".`;

	if (status === 400) {
		errorMessage = `KiloCode rejected model "${model}". Only the free model list is supported — pick one in Settings > Preferences > AI Integration.`;
	} else if (status === 401) {
		errorMessage =
			"Invalid KiloCode API key or the model requires a signed-in Kilo account. Please check your key in Settings > Preferences > AI Integration.";
	} else if (status === 402) {
		errorMessage =
			"KiloCode account has insufficient credits. Please add credits to your Kilo account.";
	} else if (status === 429) {
		errorMessage = "KiloCode rate limit exceeded. Please try again later.";
	} else if (status >= 500) {
		errorMessage =
			"KiloCode service is temporarily unavailable. Please try again later.";
	}

	const details = errorBody.trim().slice(0, 300);
	return details
		? `I encountered an error with KiloCode. ${errorMessage}\n\nDetails: ${details}`
		: `I encountered an error with KiloCode. ${errorMessage}`;
}

/**
 * Demo response for dev/test keys. Clearly labeled so nobody mistakes the
 * hardcoded sample figures for analysis of their real data.
 */
const DEMO_RESPONSE = `**Demo response — sample figures only**

A demo API key is configured, so this is a fixed sample analysis, NOT computed from your actual data:

- Total Income: $5,000.00
- Total Expenses: $730.00
- Net Savings: $4,270.00 (85.4% savings rate)

Add your real KiloCode API key in Settings > Preferences > AI Integration to get analysis based on your actual transactions.`;

export async function generateWithKiloCode(
	prompt: string,
	apiKey: string,
	modelName?: string,
	options?: { responseMimeType?: string },
): Promise<string> {
	if (apiKey === "demo-key" || apiKey.startsWith("test-real-key")) {
		return DEMO_RESPONSE;
	}

	const model = modelName?.trim() || DEFAULT_MODEL;

	let response: Response;
	try {
		response = await callKiloCode(prompt, apiKey, model, options);
	} catch (error) {
		console.error("KiloCode request failed:", error);
		const timedOut = error instanceof Error && error.name === "TimeoutError";
		if (timedOut) {
			throw new KiloCodeApiError(
				"The KiloCode request timed out. Please try again later.",
				504,
			);
		}
		throw new KiloCodeApiError(
			`Could not reach the KiloCode API. Please check your connection and try again. Details: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
			503,
		);
	}

	if (!response.ok) {
		const errorBody = await response.text();
		console.error("KiloCode API error:", response.status, errorBody);
		throw new KiloCodeApiError(
			formatKiloCodeError(response.status, errorBody, model),
			response.status,
		);
	}

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		throw new KiloCodeApiError(
			"KiloCode returned an unreadable response. Please try again.",
			502,
		);
	}

	const content = (data as { choices?: { message?: { content?: unknown } }[] })
		?.choices?.[0]?.message?.content;
	if (typeof content === "string" && content.trim()) {
		return content.trim();
	}
	throw new KiloCodeApiError(
		"KiloCode returned an empty response. Please try again.",
		502,
	);
}
