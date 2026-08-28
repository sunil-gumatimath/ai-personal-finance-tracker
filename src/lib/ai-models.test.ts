import { describe, expect, it } from "bun:test";
import {
	DEFAULT_AI_MODEL,
	LEGACY_DEFAULT_AI_MODEL,
	resolveAllowedModel,
} from "./ai-models";

// A model that is neither the current default nor the legacy default.
const OTHER_MODEL = "stepfun/step-3.7-flash:free";

describe("resolveAllowedModel", () => {
	it("falls back to the default when unset or unknown", () => {
		expect(resolveAllowedModel(undefined)).toBe(DEFAULT_AI_MODEL);
		expect(resolveAllowedModel("not/a-real-model")).toBe(DEFAULT_AI_MODEL);
	});

	it("maps the legacy default to the current default", () => {
		expect(resolveAllowedModel(LEGACY_DEFAULT_AI_MODEL)).toBe(DEFAULT_AI_MODEL);
	});

	it("keeps explicitly chosen models as-is", () => {
		expect(resolveAllowedModel(OTHER_MODEL)).toBe(OTHER_MODEL);
	});
});
