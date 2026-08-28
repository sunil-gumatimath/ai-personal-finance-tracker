import { describe, expect, it } from "bun:test";
import { resolveKiloModel } from "./_ai_kilocode.js";

// A model that is neither the current default nor the legacy default.
const OTHER_MODEL = "stepfun/step-3.7-flash:free";
// Current default (kept in sync with DEFAULT_MODEL in _ai_kilocode.ts).
const CURRENT_DEFAULT = "inclusionai/ling-3.0-flash:free";

describe("resolveKiloModel", () => {
	it("falls back to the default when unset or blank", () => {
		expect(resolveKiloModel(undefined)).toBe(CURRENT_DEFAULT);
		expect(resolveKiloModel(null)).toBe(CURRENT_DEFAULT);
		expect(resolveKiloModel("   ")).toBe(CURRENT_DEFAULT);
	});

	it("maps the legacy default to the current default", () => {
		expect(resolveKiloModel("nvidia/nemotron-3-ultra-550b-a55b:free")).toBe(
			CURRENT_DEFAULT,
		);
		expect(
			resolveKiloModel("  NVIDIA/NEMOTRON-3-ULTRA-550B-A55B:FREE  "),
		).toBe(CURRENT_DEFAULT);
	});

	it("falls back to default for unknown or deprecated models", () => {
		expect(resolveKiloModel("openai/gpt-4o:non-existent")).toBe(CURRENT_DEFAULT);
		expect(resolveKiloModel("deprecated/model:free")).toBe(CURRENT_DEFAULT);
	});

	it("keeps explicitly chosen models as-is", () => {
		expect(resolveKiloModel(OTHER_MODEL)).toBe(OTHER_MODEL);
	});
});
