import { describe, it, expect } from "bun:test";
import { escapeCsvField } from "./csv";

describe("escapeCsvField (RFC 4180)", () => {
	it("leaves plain fields untouched", () => {
		expect(escapeCsvField("hello")).toBe("hello");
		expect(escapeCsvField("groceries 2026")).toBe("groceries 2026");
	});

	it("returns an empty string for null and undefined", () => {
		expect(escapeCsvField(null)).toBe("");
		expect(escapeCsvField(undefined)).toBe("");
	});

	it("stringifies numbers", () => {
		expect(escapeCsvField(42)).toBe("42");
		expect(escapeCsvField(19.99)).toBe("19.99");
	});

	it("quotes fields containing commas", () => {
		expect(escapeCsvField("a,b")).toBe('"a,b"');
	});

	it("doubles internal quotes instead of breaking out of the field", () => {
		expect(escapeCsvField('He said "hi"')).toBe('"He said ""hi"""');
	});

	it("quotes fields containing newlines", () => {
		expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
		expect(escapeCsvField("line1\r\nline2")).toBe('"line1\r\nline2"');
	});

	it("round-trips hostile values through a CSV row parse", () => {
		const hostile = 'He said "ok", then left\r\nfor home';
		const row = [escapeCsvField(hostile), escapeCsvField("plain")].join(",");
		// Minimal RFC 4180 record parser for verification
		const parsed: string[][] = [];
		let field = "";
		const record: string[] = [];
		let inQuotes = false;
		for (let i = 0; i < row.length; i++) {
			const ch = row[i];
			if (inQuotes) {
				if (ch === '"') {
					if (row[i + 1] === '"') {
						field += '"';
						i++;
					} else {
						inQuotes = false;
					}
				} else {
					field += ch;
				}
			} else if (ch === '"') {
				inQuotes = true;
			} else if (ch === ",") {
				record.push(field);
				field = "";
			} else {
				field += ch;
			}
		}
		record.push(field);
		parsed.push(record);

		expect(parsed[0]?.[0]).toBe(hostile);
		expect(parsed[0]?.[1]).toBe("plain");
	});
});
