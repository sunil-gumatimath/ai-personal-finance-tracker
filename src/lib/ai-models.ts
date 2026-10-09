/**
 * Client-side mirror of the free-model allowlist enforced by the server
 * (api/_services/_ai_kilocode.ts — the source of truth). The server rejects
 * any model outside this list, so keeping the two in sync is what makes the
 * "free models only" guarantee hold.
 *
 * Snapshot of Kilo Gateway's $0-priced models (the `isFree: true` entries of
 * https://api.kilo.ai/api/gateway/v1/models). The catalog changes occasionally;
 * the server list can also be overridden with the KILOCODE_FREE_MODELS env var.
 */

export interface FreeAiModel {
	id: string;
	label: string;
	context: string;
	description: string;
}

export const DEFAULT_AI_MODEL = "inclusionai/ling-3.1-flash";

export const FREE_AI_MODELS: FreeAiModel[] = [
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
 * Model ids that previously shipped as the app default. Saved preferences
 * holding one resolve to the current default (mirrors resolveKiloModel on the
 * server), so existing installs pick up the new model without touching the
 * database.
 */
export const LEGACY_DEFAULT_AI_MODELS = [
	// Default before Ling 3.1 Flash — retired from the free catalog.
	"inclusionai/ling-3.0-flash-fin:free",
	// Default before Ling 3.0 Flash Fin.
	"inclusionai/ling-3.0-flash:free",
	// Default before Ling 3.0 Flash.
	"nvidia/nemotron-3-ultra-550b-a55b:free",
];

/** Resolve a saved model to a currently-allowed one, else the default. */
export function resolveAllowedModel(saved?: string): string {
	if (
		saved &&
		LEGACY_DEFAULT_AI_MODELS.some((m) => m.toLowerCase() === saved.trim().toLowerCase())
	) {
		return DEFAULT_AI_MODEL;
	}
	return saved && FREE_AI_MODELS.some((m) => m.id === saved)
		? saved
		: DEFAULT_AI_MODEL;
}
