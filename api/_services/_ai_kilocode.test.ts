import { describe, expect, it } from "bun:test";
import { getFreeModelIds, resolveKiloModel } from "./_ai_kilocode.js";

// A model that is neither the current default nor a legacy default.
const OTHER_MODEL = "stepfun/step-3.7-flash:free";
// Current default (kept in sync with DEFAULT_MODEL in _ai_kilocode.ts).
const CURRENT_DEFAULT = "inclusionai/ling-3.0-flash-fin:free";

describe("resolveKiloModel", () => {
	it("falls back to the default when unset or blank", () => {
		expect(resolveKiloModel(undefined)).toBe(CURRENT_DEFAULT);
		expect(resolveKiloModel(null)).toBe(CURRENT_DEFAULT);
		expect(resolveKiloModel("   ")).toBe(CURRENT_DEFAULT);
	});

	it("maps legacy defaults to the current default", () => {
		expect(resolveKiloModel("inclusionai/ling-3.0-flash:free")).toBe(
			CURRENT_DEFAULT,
		);
		expect(resolveKiloModel("nvidia/nemotron-3-ultra-550b-a55b:free")).toBe(
			CURRENT_DEFAULT,
		);
		expect(
			resolveKiloModel("  INCLUSIONAI/LING-3.0-FLASH:FREE  "),
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

describe("getFreeModelIds", () => {
	it("returns unique ids and contains the current default", () => {
		const ids = getFreeModelIds();
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain(CURRENT_DEFAULT);
	});

	it("honours the KILOCODE_FREE_MODELS override", () => {
		const previous = process.env.KILOCODE_FREE_MODELS;
		process.env.KILOCODE_FREE_MODELS = "vendor/model-a:free, vendor/model-b:free";
		try {
			expect(getFreeModelIds()).toEqual([
				"vendor/model-a:free",
				"vendor/model-b:free",
			]);
		} finally {
			if (previous === undefined) delete process.env.KILOCODE_FREE_MODELS;
			else process.env.KILOCODE_FREE_MODELS = previous;
		}
	});
});
