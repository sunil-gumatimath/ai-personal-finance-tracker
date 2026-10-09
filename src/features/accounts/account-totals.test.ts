import { describe, expect, it } from "bun:test";
import {
	filterAndSortAccounts,
	partitionByActive,
	summarizeAccounts,
} from "./account-totals";
import type { Account } from "@/types";

function account(over: Partial<Account> = {}): Account {
	return {
		id: "a1",
		user_id: "u1",
		name: "Checking",
		type: "checking",
		// Decimal(15,2) arrives as a string from pg — the default exercises that.
		balance: "100",
		currency: "USD",
		color: "#000000",
		icon: "checking",
		is_active: true,
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
		...over,
	};
}

describe("summarizeAccounts", () => {
	it("sums every active account into net worth", () => {
		const totals = summarizeAccounts([
			account({ id: "1", balance: "250.50" }),
			account({ id: "2", balance: "100" }),
		]);
		expect(totals.totalBalance).toBe(350.5);
		expect(totals.totalAssets).toBe(350.5);
		expect(totals.totalLiabilities).toBe(0);
	});

	it("excludes archived accounts from every total", () => {
		const totals = summarizeAccounts([
			account({ id: "1", balance: "100" }),
			account({ id: "2", balance: "9999", is_active: false }),
		]);
		expect(totals.totalBalance).toBe(100);
		expect(totals.totalAssets).toBe(100);
	});

	it("reports credit-card debt as positive liabilities and counts it as a deficit", () => {
		// A credit card is an obligation, so its balance is negative by design
		// (`api/_domain/accounts.ts` `assertBalance`).
		const totals = summarizeAccounts([
			account({ id: "1", balance: "500" }),
			account({ id: "2", type: "credit", balance: "-250" }),
		]);
		expect(totals.totalAssets).toBe(500);
		expect(totals.totalLiabilities).toBe(250);
		expect(totals.totalBalance).toBe(250);
	});

	it("treats a net-negative position as a deficit", () => {
		const totals = summarizeAccounts([
			account({ id: "1", balance: "100" }),
			account({ id: "2", type: "credit", balance: "-400" }),
		]);
		expect(totals.totalBalance).toBe(-300);
		expect(totals.totalLiabilities).toBe(400);
	});
});

describe("filterAndSortAccounts", () => {
	const rows = [
		account({ id: "1", name: "Zeta Savings", type: "savings", balance: "50" }),
		account({ id: "2", name: "Alpha Card", type: "credit", balance: "-20" }),
		account({ id: "3", name: "Mid Checking", type: "checking", balance: "900" }),
	];

	it("matches names case-insensitively", () => {
		const out = filterAndSortAccounts(rows, {
			searchQuery: "zEtA",
			filterType: "all",
			sortBy: "name",
		});
		expect(out.map((r) => r.id)).toEqual(["1"]);
	});

	it("ignores an empty search query", () => {
		const out = filterAndSortAccounts(rows, {
			searchQuery: "",
			filterType: "all",
			sortBy: "name",
		});
		expect(out).toHaveLength(3);
	});

	it("treats a whitespace-only search as no filter", () => {
		const out = filterAndSortAccounts(rows, {
			searchQuery: "   ",
			filterType: "all",
			sortBy: "name",
		});
		expect(out).toHaveLength(3);
	});

	it("intersects search and type filter", () => {
		const out = filterAndSortAccounts(rows, {
			searchQuery: "a",
			filterType: "savings",
			sortBy: "name",
		});
		expect(out.map((r) => r.id)).toEqual(["1"]);
	});

	it("sorts by balance descending, comparing string decimals numerically", () => {
		const out = filterAndSortAccounts(rows, {
			searchQuery: "",
			filterType: "all",
			sortBy: "balance",
		});
		expect(out.map((r) => r.id)).toEqual(["3", "1", "2"]);
	});

	it("sorts by name ascending and by date newest-first", () => {
		expect(
			filterAndSortAccounts(rows, {
				searchQuery: "",
				filterType: "all",
				sortBy: "name",
			}).map((r) => r.name),
		).toEqual(["Alpha Card", "Mid Checking", "Zeta Savings"]);

		const dated = [
			account({ id: "old", name: "Old", created_at: "2020-01-01T00:00:00Z" }),
			account({ id: "new", name: "New", created_at: "2026-01-01T00:00:00Z" }),
		];
		expect(
			filterAndSortAccounts(dated, {
				searchQuery: "",
				filterType: "all",
				sortBy: "created",
			}).map((r) => r.id),
		).toEqual(["new", "old"]);
	});

	it("does not mutate the input array", () => {
		const input = [...rows];
		const before = input.map((r) => r.id);
		filterAndSortAccounts(input, {
			searchQuery: "",
			filterType: "all",
			sortBy: "balance",
		});
		expect(input.map((r) => r.id)).toEqual(before);
	});
});

describe("partitionByActive", () => {
	it("splits into active and archived without losing rows", () => {
		const { activeAccounts, inactiveAccounts } = partitionByActive([
			account({ id: "1", is_active: true }),
			account({ id: "2", is_active: false }),
			account({ id: "3", is_active: true }),
		]);
		expect(activeAccounts.map((r) => r.id)).toEqual(["1", "3"]);
		expect(inactiveAccounts.map((r) => r.id)).toEqual(["2"]);
	});
});