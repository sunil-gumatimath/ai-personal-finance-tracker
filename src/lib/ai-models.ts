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

export const DEFAULT_AI_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

export const FREE_AI_MODELS: FreeAiModel[] = [
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

/** Resolve a saved model to a currently-allowed one, else the default. */
export function resolveAllowedModel(saved?: string): string {
	return saved && FREE_AI_MODELS.some((m) => m.id === saved)
		? saved
		: DEFAULT_AI_MODEL;
}
