/**
 * Client-side mirror of the free-model allowlist enforced by the server
 * (api/services/_ai_kilocode.ts — the source of truth). The server rejects
 * any model outside this list, so keeping the two in sync is what makes the
 * "free models only" guarantee hold.
 *
 * Snapshot of Kilo Gateway's $0-priced models (kilo.ai/landing/free-models).
 * The catalog changes occasionally; the server list can also be overridden
 * with the KILOCODE_FREE_MODELS env var.
 */

export interface FreeAiModel {
	id: string;
	label: string;
	context: string;
	description: string;
}

export const DEFAULT_AI_MODEL = "inclusionai/ling-3.0-flash:free";

export const FREE_AI_MODELS: FreeAiModel[] = [
	{
		id: "inclusionai/ling-3.0-flash:free",
		label: "Ling 3.0 Flash (Recommended Default)",
		context: "262K",
		description:
			"Token-efficient MoE — lightning-fast responses & structured JSON formatting.",
	},
	{
		id: "kilo-auto/free",
		label: "Kilo Auto (Free Smart Router)",
		context: "128K",
		description:
			"Automatically routes requests to the best available free model dynamically.",
	},
	{
		id: "deepseek/deepseek-r1:free",
		label: "DeepSeek R1 (Free)",
		context: "128K",
		description: "Open reasoning flagship with deep financial analysis & chain-of-thought.",
	},
	{
		id: "meta-llama/llama-3.3-70b-instruct:free",
		label: "Llama 3.3 70B Instruct (Free)",
		context: "128K",
		description: "Meta's flagship 70B open-weights model with excellent conversational polish.",
	},
	{
		id: "qwen/qwen-2.5-72b-instruct:free",
		label: "Qwen 2.5 72B Instruct (Free)",
		context: "128K",
		description: "Alibaba Cloud flagship model with top-tier mathematics and structured parsing.",
	},
	{
		id: "mistralai/mistral-small-24b-instruct-2501:free",
		label: "Mistral Small 24B (Free)",
		context: "32K",
		description: "Mistral fast and precise instruction-following model.",
	},
	{
		id: "google/gemma-2-9b-it:free",
		label: "Google Gemma 2 9B (Free)",
		context: "8K",
		description: "Compact and fast instruction model by Google.",
	},
	{
		id: "nvidia/nemotron-3-ultra-550b-a55b:free",
		label: "Nemotron 3 Ultra (Free)",
		context: "1M",
		description:
			"NVIDIA 550B flagship reasoning model — deepest quality, higher latency.",
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
		description: "Fast NVIDIA compact reasoning model.",
	},
	{
		id: "stepfun/step-3.7-flash:free",
		label: "Step 3.7 Flash (Free)",
		context: "262K",
		description: "StepFun high-throughput chat model.",
	},
	{
		id: "cohere/north-mini-code:free",
		label: "North Mini Code (Free)",
		context: "256K",
		description: "Cohere compact structured output model.",
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
		description: "Tencent high-speed chat model.",
	},
	{
		id: "z-ai/glm-5:free",
		label: "Z-AI GLM 5 (Free)",
		context: "128K",
		description: "Z-AI multilingual conversational model.",
	},
];

/**
 * Model id that shipped as the app default before Ling 3.0 Flash. Saved
 * preferences holding it resolve to the current default (mirrors
 * resolveKiloModel on the server), so existing installs pick up the faster
 * model without touching the database.
 */
export const LEGACY_DEFAULT_AI_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

/** Resolve a saved model to a currently-allowed one, else the default. */
export function resolveAllowedModel(saved?: string): string {
	if (saved && saved.trim().toLowerCase() === LEGACY_DEFAULT_AI_MODEL.toLowerCase()) {
		return DEFAULT_AI_MODEL;
	}
	return saved && FREE_AI_MODELS.some((m) => m.id === saved)
		? saved
		: DEFAULT_AI_MODEL;
}
