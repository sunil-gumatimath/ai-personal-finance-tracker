import { describe, it, expect } from "bun:test";
import { parseTransactionDate } from "./date-utils";

describe("parseTransactionDate", () => {
	it("parses 'YYYY-MM-DD' as a LOCAL date with no day shift", () => {
		// Assertions use local-date parts (not UTC), so they hold in any TZ:
		// the old `new Date("2026-08-01")` UTC parse would report July 31 in
		// timezones behind UTC.
		const d = parseTransactionDate("2026-08-01");
		expect(d.getFullYear()).toBe(2026);
		expect(d.getMonth()).toBe(7); // August is month index 7
		expect(d.getDate()).toBe(1);
		expect(d.getHours()).toBe(0);
		expect(d.getMinutes()).toBe(0);
		expect(d.getSeconds()).toBe(0);

		const d2 = parseTransactionDate("2024-01-31");
		expect(d2.getFullYear()).toBe(2024);
		expect(d2.getMonth()).toBe(0);
		expect(d2.getDate()).toBe(31);

		const d3 = parseTransactionDate("2023-03-01"); // month boundary
		expect(d3.getDate()).toBe(1);
		expect(d3.getMonth()).toBe(2);
	});

	it("round-trips local YYYY-MM-DD formatting", () => {
		const d = parseTransactionDate("2026-12-25");
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		expect(`${y}-${m}-${day}`).toBe("2026-12-25");
	});

	it("returns the same Date instance when given a Date", () => {
		const original = new Date(2026, 4, 17, 13, 45);
		expect(parseTransactionDate(original)).toBe(original);
	});

	it("falls back to standard Date parsing for full ISO timestamps", () => {
		const iso = "2026-08-01T10:30:00Z";
		const d = parseTransactionDate(iso);
		expect(isNaN(d.getTime())).toBe(false);
		expect(d.getTime()).toBe(Date.parse(iso));
	});

	it("returns an invalid Date for invalid inputs", () => {
		expect(isNaN(parseTransactionDate("").getTime())).toBe(true);
		expect(isNaN(parseTransactionDate(null).getTime())).toBe(true);
		expect(isNaN(parseTransactionDate(undefined).getTime())).toBe(true);
		expect(isNaN(parseTransactionDate(42).getTime())).toBe(true);
	});
});
