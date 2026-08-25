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
		expect(toNumber("  12.5 ")).toBe(12.5); // parseFloat trims whitespace
		expect(toNumber("0")).toBe(0);
	});

	it("returns 0 for non-numeric strings", () => {
		expect(toNumber("")).toBe(0);
		expect(toNumber("   ")).toBe(0);
		expect(toNumber("abc")).toBe(0);
	});

	it("returns the leading numeric prefix of partially numeric strings", () => {
		// parseFloat semantics: leading numeric portion wins
		expect(toNumber("12.5abc")).toBe(12.5);
		expect(toNumber("1e3")).toBe(1000);
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
