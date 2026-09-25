import { describe, expect, it } from "bun:test";
import {
	DEFAULT_AI_MODEL,
	FREE_AI_MODELS,
	LEGACY_DEFAULT_AI_MODELS,
	resolveAllowedModel,
} from "./ai-models";

// A model that is neither the current default nor a legacy default.
const OTHER_MODEL = "stepfun/step-3.7-flash:free";

describe("resolveAllowedModel", () => {
	it("falls back to the default when unset or unknown", () => {
		expect(resolveAllowedModel(undefined)).toBe(DEFAULT_AI_MODEL);
		expect(resolveAllowedModel("not/a-real-model")).toBe(DEFAULT_AI_MODEL);
	});

	it("maps every legacy default to the current default", () => {
		for (const legacy of LEGACY_DEFAULT_AI_MODELS) {
			expect(resolveAllowedModel(legacy)).toBe(DEFAULT_AI_MODEL);
		}
	});

	it("keeps explicitly chosen models as-is", () => {
		expect(resolveAllowedModel(OTHER_MODEL)).toBe(OTHER_MODEL);
	});

	it("only allowlists models, and includes the current default", () => {
		const ids = FREE_AI_MODELS.map((m) => m.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain(DEFAULT_AI_MODEL);
	});
});
