const KILOCODE_BASE_URL = "https://api.kilo.ai/api/gateway/v1";

/**
 * Upper bound for a single KiloCode request; a hang must not block the server.
 * Kept at 60s — free-tier reasoning models can be slow. On Vercel the
 * function's maxDuration (api/handler.ts) enforces the same ceiling.
 */
const REQUEST_TIMEOUT_MS = 50_000;

interface FreeModel {
	id: string;
	label: string;
	context: string;
	description: string;
}

/**
 * Snapshot of the Kilo Gateway's $0-priced ("free") models, from Kilo's live
 * free-models catalog (https://api.kilo.ai/api/gateway/v1/models, entries with
 * `isFree: true`). The catalog changes over time — when it does, update this
 * list or set the KILOCODE_FREE_MODELS env var (comma-separated model IDs) to
 * override it without code changes.
 *
 * Excluded from the catalog on purpose:
 * - `nvidia/nemotron-3.5-content-safety:free` — a guardrail/moderation model,
 *   not a general-purpose assistant.
 * - `stealth/*` — anonymous third-party re-serves, a needless privacy downgrade
 *   for a financial app.
 *
 * Ordered by recommended usage: fast, finance-tuned models first (chat feels
 * instant), deep-reasoning models after for users who prefer quality over speed.
 */
const FREE_MODELS: FreeModel[] = [
	{
		id: "inclusionai/ling-3.1-flash",
		label: "Ling 3.1 Flash (Recommended Default)",
		context: "262K",
		description:
			"Fast hybrid-reasoning MoE (25B active / 560B) — instant chat, successor to the retired Ling 3.0 Flash Fin.",
	},
	{
		id: "stepfun/step-5-preview-free",
		label: "Step 5 Preview (Free)",
		context: "1M",
		description:
			"StepFun flagship for agentic work — strong on finance and professional knowledge, text/image/video in, 1M context.",
	},
	{
		id: "kilo-auto/free",
		label: "Auto Free (Smart Router)",
		context: "256K",
		description:
			"Rotates through the available free models — no credits required, capability varies.",
	},
	{
		id: "openrouter/free",
		label: "OpenRouter Free Router (Free)",
		context: "200K",
		description:
			"OpenRouter's free router — picks from OpenRouter's free model pool per request.",
	},
	{
		id: "liquid/lfm-2.5-2.6b:free",
		label: "LFM2.5 2.6B (Free)",
		context: "64K",
		description: "Compact Liquid AI model — great for data extraction and RAG.",
	},
	{
		id: "dots-studio/dots-3-note-preview:free",
		label: "Dots3-Note Preview (Free)",
		context: "512K",
		description: "Dots Studio MoE (16B active / 280B) — long-context note and doc work.",
	},
	{
		id: "thinkingmachines/inkling-small:free",
		label: "Inkling Small (Free)",
		context: "1M",
		description: "Thinking Machines Lab multimodal MoE (12B active / 276B) with 1M context.",
	},
	{
		id: "nvidia/nemotron-3.5-lightning:free",
		label: "Nemotron 3.5 Lightning (Free)",
		context: "1M",
		description:
			"NVIDIA MoE (3B active / 30B) — high-throughput agentic workloads, 1M context.",
	},
	{
		id: "cohere/north-mini-code:free",
		label: "North Mini Code (Free)",
		context: "256K",
		description: "Cohere compact structured-output model.",
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
		id: "nvidia/nemotron-3-super-120b-a12b:free",
		label: "Nemotron 3 Super (Free)",
		context: "262K",
		description: "NVIDIA hybrid MoE reasoning model.",
	},
	{
		id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
		label: "Nemotron 3 Nano Omni (Free)",
		context: "256K",
		description: "Fast NVIDIA compact reasoning model (text, image, audio, video in).",
	},
	{
		id: "nvidia/nemotron-3-ultra-550b-a55b:free",
		label: "Nemotron 3 Ultra (Free)",
		context: "1M",
		description:
			"NVIDIA 550B flagship reasoning model — deepest quality, higher latency.",
	},
];

/**
 * Fast default: Ling 3.1 Flash keeps chat answers instant and is the direct
 * successor to the retired finance-tuned Ling 3.0 Flash Fin. Users who want
 * deeper reasoning can pick Step 5 Preview or Nemotron Ultra in Settings (both
 * stay on the allowlist).
 */
const DEFAULT_MODEL = "inclusionai/ling-3.1-flash";

/**
 * Model ids that previously shipped as the app default. Profiles that still
 * store one (saved before a switch) resolve to the current default instead of
 * being pinned to a retired model.
 */
const LEGACY_DEFAULT_MODELS = [
	// Default before Ling 3.1 Flash — retired from the free catalog.
	"inclusionai/ling-3.0-flash-fin:free",
	// Default before Ling 3.0 Flash Fin.
	"inclusionai/ling-3.0-flash:free",
	// Default before Ling 3.0 Flash — retired from the free catalog.
	"nvidia/nemotron-3-ultra-550b-a55b:free",
];

/** Resolves a saved model id to the model actually called: unset, unknown or legacy-default falls back to DEFAULT_MODEL. */
export function resolveKiloModel(modelName?: string | null): string {
	const trimmed = modelName?.trim();
	if (
		!trimmed ||
		LEGACY_DEFAULT_MODELS.some((m) => m.toLowerCase() === trimmed.toLowerCase())
	) {
		return DEFAULT_MODEL;
	}
	const allowed = getFreeModelIds().map((id) => id.toLowerCase());
	if (!allowed.includes(trimmed.toLowerCase())) {
		return DEFAULT_MODEL;
	}
	return trimmed;
}

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

/**
 * Merges the hard 60s upstream timeout with the client-disconnect signal so a
 * long generation is cancelled as soon as either fires (M1). When no client
 * signal is supplied we keep the standalone timeout.
 */
function upstreamSignal(clientSignal?: AbortSignal): AbortSignal {
	if (clientSignal) {
		return AbortSignal.any([clientSignal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
	}
	return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

async function callKiloCode(
	prompt: string,
	apiKey: string,
	model: string,
	options?: { responseMimeType?: string; stream?: boolean },
	signal?: AbortSignal,
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
			stream: options?.stream || undefined,
			response_format:
				options?.responseMimeType === "application/json"
					? { type: "json_object" }
					: undefined,
		}),
		signal: upstreamSignal(signal),
	});
}

/** Maps a failed fetch() to a KiloCodeApiError with a client-safe message. */
function mapConnectionError(error: unknown): KiloCodeApiError {
	const timedOut = error instanceof Error && error.name === "TimeoutError";
	if (timedOut) {
		return new KiloCodeApiError(
			"The KiloCode request timed out. Please try again later.",
			504,
		);
	}
	// Log the underlying cause server-side; the client gets a canned message.
	console.error(
		"KiloCode connection failure details:",
		error instanceof Error ? error.message : String(error),
	);
	return new KiloCodeApiError(
		"Could not reach the KiloCode API. Please check your connection and try again.",
		503,
	);
}

/**
 * Canned, client-safe error messages. Upstream response bodies are logged
 * server-side (see the caller) but never forwarded to clients.
 */
function formatKiloCodeError(status: number, model: string) {
	if (status === 400) {
		return `KiloCode rejected model "${model}". Only the free model list is supported — pick one in Settings > Preferences > AI Integration.`;
	}
	if (status === 401) {
		return "Invalid KiloCode API key or the model requires a signed-in Kilo account. Please check your key in Settings > Preferences > AI Integration.";
	}
	if (status === 402) {
		return "KiloCode account has insufficient credits. Please add credits to your Kilo account.";
	}
	if (status === 429) {
		return "KiloCode rate limit exceeded. Please try again later.";
	}
	if (status >= 500) {
		return "KiloCode service is temporarily unavailable. Please try again later.";
	}
	return `KiloCode API error (${status}) while using model "${model}".`;
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
	signal?: AbortSignal,
): Promise<string> {
	if (apiKey === "demo-key" || apiKey.startsWith("test-real-key")) {
		return DEMO_RESPONSE;
	}

	const model = resolveKiloModel(modelName);

	let response: Response;
	try {
		response = await callKiloCode(prompt, apiKey, model, options, signal);
	} catch (error) {
		console.error("KiloCode request failed:", error);
		throw mapConnectionError(error);
	}

	if (!response.ok) {
		const errorBody = await response.text();
		// Upstream body stays in server logs only — never echoed to clients.
		console.error("KiloCode API error:", response.status, errorBody);
		throw new KiloCodeApiError(
			formatKiloCodeError(response.status, model),
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

/**
 * Streaming variant of generateWithKiloCode: yields answer text deltas as
 * they arrive from the gateway (SSE `chat/completions` chunks). Reasoning
 * models may also emit `delta.reasoning_content`; only user-visible
 * `delta.content` is forwarded. Throws KiloCodeApiError before the first
 * delta for HTTP/connection failures, or mid-stream if the connection dies.
 */
export async function* streamWithKiloCode(
	prompt: string,
	apiKey: string,
	modelName?: string,
	options?: { responseMimeType?: string },
	signal?: AbortSignal,
): AsyncGenerator<string> {
	if (apiKey === "demo-key" || apiKey.startsWith("test-real-key")) {
		yield DEMO_RESPONSE;
		return;
	}

	const model = resolveKiloModel(modelName);

	let response: Response;
	try {
		response = await callKiloCode(
			prompt,
			apiKey,
			model,
			{
				...options,
				stream: true,
			},
			signal,
		);
	} catch (error) {
		console.error("KiloCode streaming request failed:", error);
		throw mapConnectionError(error);
	}

	if (!response.ok) {
		const errorBody = await response.text();
		// Upstream body stays in server logs only — never echoed to clients.
		console.error("KiloCode API error:", response.status, errorBody);
		throw new KiloCodeApiError(
			formatKiloCodeError(response.status, model),
			response.status,
		);
	}

	if (!response.body) {
		throw new KiloCodeApiError(
			"KiloCode returned an unreadable response. Please try again.",
			502,
		);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			let newlineIndex: number;
			while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
				const line = buffer.slice(0, newlineIndex).trim();
				buffer = buffer.slice(newlineIndex + 1);
				if (!line.startsWith("data:")) continue;
				const payload = line.slice(5).trim();
				if (!payload || payload === "[DONE]") continue;
				try {
					const parsed = JSON.parse(payload) as {
						error?: { message?: string; code?: number };
						choices?: { delta?: { content?: unknown } }[];
					};
					if (parsed?.error?.message) {
						throw new KiloCodeApiError(
							parsed.error.message,
							typeof parsed.error.code === "number" ? parsed.error.code : 502,
						);
					}
					const delta = parsed?.choices?.[0]?.delta?.content;
					if (typeof delta === "string" && delta) yield delta;
				} catch (e) {
					if (e instanceof KiloCodeApiError) throw e;
					// Malformed chunk — skip it rather than killing the stream.
				}
			}
		}
		if (buffer.trim().startsWith("data:")) {
			const payload = buffer.trim().slice(5).trim();
			if (payload && payload !== "[DONE]") {
				try {
					const parsed = JSON.parse(payload) as {
						error?: { message?: string; code?: number };
						choices?: { delta?: { content?: unknown } }[];
					};
					if (parsed?.error?.message) {
						throw new KiloCodeApiError(
							parsed.error.message,
							typeof parsed.error.code === "number" ? parsed.error.code : 502,
						);
					}
					const delta = parsed?.choices?.[0]?.delta?.content;
					if (typeof delta === "string" && delta) yield delta;
				} catch (e) {
					if (e instanceof KiloCodeApiError) throw e;
					// Malformed trailing chunk — skip
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}
