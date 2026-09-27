import { describe, it, expect } from "bun:test";
import {
	toDateKey,
	toMonthKey,
	isDateInRange,
	savingsRatePercent,
	savingsScoreFromPercent,
} from "./date-range";

describe("toDateKey", () => {
	it("passes a date-only string through unchanged", () => {
		expect(toDateKey("2026-09-27")).toBe("2026-09-27");
	});

	it("strips the time component from a full ISO timestamp", () => {
		expect(toDateKey("2026-09-27T14:30:00.000Z")).toBe("2026-09-27");
	});

	it("reads a Date in LOCAL time, not UTC", () => {
		// The bug this replaces: `String(date).split("T")[0]` on a Date returns
		// the ENTIRE string ("Mon Sep 28 2026 ..."), because String(Date) has
		// no "T" to split on — so every comparison silently misbehaved.
		const d = new Date(2026, 8, 27, 23, 30);
		expect(toDateKey(d)).toBe("2026-09-27");
	});

	it("handles a month boundary in local time", () => {
		// 00:30 local on the 1st is still the previous UTC day in most of the
		// Americas; a UTC-based extraction would file this under the 31st.
		const d = new Date(2026, 8, 1, 0, 30);
		expect(toDateKey(d)).toBe("2026-09-01");
	});

	it("returns an empty string for null, undefined, and invalid input", () => {
		expect(toDateKey(null)).toBe("");
		expect(toDateKey(undefined)).toBe("");
		expect(toDateKey("not a date")).toBe("");
		expect(toDateKey(new Date("nope"))).toBe("");
	});
});

describe("toMonthKey", () => {
	it("buckets by local calendar month", () => {
		expect(toMonthKey("2026-09-27T23:00:00Z")).toBe("2026-09");
		expect(toMonthKey(new Date(2026, 0, 15))).toBe("2026-01");
	});
});

describe("isDateInRange", () => {
	it("is inclusive on both bounds", () => {
		expect(isDateInRange("2026-09-01", "2026-09-01", "2026-09-30")).toBe(true);
		expect(isDateInRange("2026-09-30", "2026-09-01", "2026-09-30")).toBe(true);
		expect(isDateInRange("2026-08-31", "2026-09-01", "2026-09-30")).toBe(false);
		expect(isDateInRange("2026-10-01", "2026-09-01", "2026-09-30")).toBe(false);
	});

	it("treats a missing end as open-ended", () => {
		expect(isDateInRange("2030-01-01", "2026-09-01")).toBe(true);
	});
});

describe("savingsRatePercent", () => {
	// One definition now, shared by the Dashboard, Reports and the health hook.
	// Previously: Dashboard/Reports produced a signed percentage while the
	// health hook produced a clamped 0..1 ratio, so an overspending user saw
	// different numbers on adjacent screens.
	it("returns a signed percentage", () => {
		expect(savingsRatePercent(1000, 200)).toBe(80);
		expect(savingsRatePercent(1000, 1000)).toBe(0);
		// Overspending: negative, NOT clamped to 0.
		expect(savingsRatePercent(1000, 1200)).toBe(-20);
	});

	it("returns 0 when there is no income to divide by", () => {
		expect(savingsRatePercent(0, 500)).toBe(0);
		expect(savingsRatePercent(0, 0)).toBe(0);
	});
});

describe("savingsScoreFromPercent", () => {
	it("clamps a negative rate to 0", () => {
		// The health card's 0..100 contribution. A negative savings rate floors
		// here, distinctly from the displayed percentage.
		expect(savingsScoreFromPercent(-20)).toBe(0);
	});

	it("clamps above 100", () => {
		expect(savingsScoreFromPercent(140)).toBe(100);
	});

	it("passes a normal rate through", () => {
		expect(savingsScoreFromPercent(20)).toBe(20);
		expect(savingsScoreFromPercent(0)).toBe(0);
	});
});
