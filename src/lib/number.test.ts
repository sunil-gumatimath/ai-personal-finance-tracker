import { describe, it, expect } from "bun:test";
import { toNumber } from "./number";

describe("toNumber", () => {
	it("passes numbers through unchanged", () => {
		expect(toNumber(0)).toBe(0);
		expect(toNumber(42)).toBe(42);
		expect(toNumber(-3.5)).toBe(-3.5);
		expect(toNumber(1234.56)).toBe(1234.56);
	});

	it("coerces finite numeric strings", () => {
		expect(toNumber("42")).toBe(42);
		expect(toNumber("-7.25")).toBe(-7.25);
		expect(toNumber("  12.5 ")).toBe(12.5); // surrounding whitespace is trimmed
		expect(toNumber("0")).toBe(0);
		expect(toNumber("+5")).toBe(5); // leading plus is tolerated
		expect(toNumber(".5")).toBe(0.5); // bare leading decimal point
		expect(toNumber("1234.5")).toBe(1234.5);
	});

	it("returns 0 for non-numeric strings", () => {
		expect(toNumber("")).toBe(0);
		expect(toNumber("   ")).toBe(0);
		expect(toNumber("abc")).toBe(0);
	});

	it("rejects partially numeric strings instead of silently truncating", () => {
		// Regression: `toNumber` used a bare `parseFloat`, which returns the
		// leading numeric portion of anything. On a money field that produced a
		// plausible-looking but wrong number rather than an obvious failure:
		//
		//   "1,234.56" -> 1        (1000x too small)
		//   "$45.00"   -> 0        (amount lost entirely)
		//   "12.5%"    -> 12.5     (unit silently dropped)
		//   "1e3"      -> 1000     (exponent notation accepted)
		//
		// All now normalise to 0, which is visible, instead of a wrong figure.
		expect(toNumber("12.5abc")).toBe(0);
		expect(toNumber("1e3")).toBe(0);
		expect(toNumber("1,234.56")).toBe(0);
		expect(toNumber("$45.00")).toBe(0);
		expect(toNumber("12.5%")).toBe(0);
		expect(toNumber("1.234")).toBe(0); // >2 decimal places
		expect(toNumber("1.2.3")).toBe(0);
		expect(toNumber("1-2")).toBe(0);
	});

	it("returns 0 for null and undefined", () => {
		expect(toNumber(null)).toBe(0);
		expect(toNumber(undefined)).toBe(0);
	});

	it("returns 0 for non-finite numbers", () => {
		expect(toNumber(Number.NaN)).toBe(0);
		expect(toNumber(Number.POSITIVE_INFINITY)).toBe(0);
		expect(toNumber(Number.NEGATIVE_INFINITY)).toBe(0);
	});
});
