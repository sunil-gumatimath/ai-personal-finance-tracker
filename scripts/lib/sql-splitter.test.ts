import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { splitSqlStatements } from "./sql-splitter";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "..", "database", "migrations");

function readMigration(name: string): string {
	return readFileSync(join(MIGRATIONS_DIR, name), "utf8");
}

/** Heuristic sanity check: every $$ delimiter opened must be closed within a statement. */
function countDollarQuotes(statement: string): number {
	return (statement.match(/\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/g) ?? []).length;
}

const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
	.filter((f) => f.endsWith(".sql"))
	.sort();

describe("splitSqlStatements", () => {
	test("discovers all migration files", () => {
		expect(MIGRATION_FILES).toEqual([
			"001_initial_schema.sql",
			"002_debts_and_payments.sql",
			"003_system_logs.sql",
			"004_security_hardening.sql",
			"005_recurring_and_digests.sql",
			"006_data_integrity.sql",
			"007_row_level_security_staged.sql",
		]);
	});

	for (const file of MIGRATION_FILES) {
		test(`${file}: splits into complete, well-formed statements`, () => {
			const statements = splitSqlStatements(readMigration(file));

			// Exact statement counts (one statement per Neon HTTP request).
			const expectedCounts: Record<string, number> = {
				"001_initial_schema.sql": 38,
				"002_debts_and_payments.sql": 13,
				"003_system_logs.sql": 4,
				"004_security_hardening.sql": 15,
				"005_recurring_and_digests.sql": 3,
				"006_data_integrity.sql": 17,
				"007_row_level_security_staged.sql": 22,
			};
			expect(statements.length).toBe(expectedCounts[file]);

			for (const stmt of statements) {
				// Every statement terminates with a semicolon.
				expect(stmt.endsWith(";")).toBe(true);
				// No orphaned plpgsql fragments.
				expect(stmt === "END").toBe(false);
				expect(stmt.startsWith("END\n")).toBe(false);
				expect(stmt === "RETURN NEW;").toBe(false);
				// Dollar quotes are balanced ($$ or $tag$ come in pairs).
				expect(countDollarQuotes(stmt) % 2).toBe(0);
				// No dangling single-line comment markers mid-statement garbage:
				// statement must contain at least one non-comment character
				// (guaranteed by splitter, but assert anyway).
				expect(stmt.replace(/--[^\n]*/g, "").trim().length).toBeGreaterThan(0);
			}

			// Function bodies survive intact: any statement containing a function
			// body must end with its LANGUAGE clause terminator.
			for (const stmt of statements) {
				if (stmt.includes("$$") && stmt.includes("LANGUAGE")) {
					expect(stmt.trimEnd().endsWith(";")).toBe(true);
					expect(stmt).toMatch(/\$\$ LANGUAGE plpgsql;\s*$/);
				}
			}
		});
	}

	test("001: both trigger functions stay whole", () => {
		const statements = splitSqlStatements(readMigration("001_initial_schema.sql"));
		const bodies = statements.filter((s) => s.includes("RETURNS TRIGGER AS $$"));
		expect(bodies.length).toBe(2); // update_updated_at_column, update_account_balance
		for (const body of bodies) {
			expect(body.trimEnd().endsWith("$$ LANGUAGE plpgsql;")).toBe(true);
			expect(body).toContain("RETURN NEW;");
			// The balance trigger must keep its full IF/ELSIF chain together.
			if (body.includes("update_account_balance")) {
				expect(body).toContain("TG_OP = 'DELETE'");
				expect(body).toContain("TG_OP = 'INSERT'");
				expect(body).toContain("TG_OP = 'UPDATE'");
			}
		}
	});

	test("002: debt payment trigger stays whole", () => {
		const statements = splitSqlStatements(readMigration("002_debts_and_payments.sql"));
		const body = statements.find((s) => s.includes("update_debt_balance_on_payment"));
		expect(body).toBeDefined();
		expect(body!.trimEnd().endsWith("$$ LANGUAGE plpgsql;")).toBe(true);
	});

	test("006: DO blocks and rewritten trigger survive", () => {
		const statements = splitSqlStatements(readMigration("006_data_integrity.sql"));
		const doBlocks = statements.filter((s) => /(^|\n)DO \$\$/.test(s));
		expect(doBlocks.length).toBe(4); // debt_payments checks, debts check, goals check, budgets FK
		for (const block of doBlocks) {
			expect(block.trimEnd().endsWith("$$;")).toBe(true);
			expect(countDollarQuotes(block) % 2).toBe(0);
		}
		const triggerFn = statements.find((s) => s.includes("update_debt_balance_on_payment"));
		expect(triggerFn).toBeDefined();
	});

	test("007: policies split into individual statements", () => {
		const statements = splitSqlStatements(readMigration("007_row_level_security_staged.sql"));
		const creates = statements.filter((s) => /CREATE POLICY tenant_isolation_/i.test(s));
		expect(creates.length).toBe(11);
	});

	test("handles semicolons inside line comments", () => {
		const sql = "-- note; this must not split\nSELECT 1;\n-- trailing comment;";
		expect(splitSqlStatements(sql)).toEqual(["-- note; this must not split\nSELECT 1;"]);
	});

	test("handles semicolons inside block comments (incl. nesting)", () => {
		const sql = "/* outer; /* inner; */ still comment; */ SELECT 1; SELECT 2;";
		expect(splitSqlStatements(sql)).toEqual(["/* outer; /* inner; */ still comment; */ SELECT 1;", "SELECT 2;"]);
	});

	test("handles semicolons inside single-quoted strings with '' escapes", () => {
		const sql = "SELECT 'a'';b'; SELECT 2;";
		expect(splitSqlStatements(sql)).toEqual(["SELECT 'a'';b';", "SELECT 2;"]);
	});

	test("handles dollar-quoted strings including tags", () => {
		const sql = "DO $$ BEGIN RAISE EXCEPTION 'a;b'; END $$; CREATE FUNCTION f() RETURNS void AS $fn$ BEGIN PERFORM 1; END; $fn$ LANGUAGE plpgsql; SELECT 3;";
		const statements = splitSqlStatements(sql);
		expect(statements.length).toBe(3);
		expect(statements[0]).toContain("RAISE EXCEPTION 'a;b'");
		expect(statements[1].trimEnd().endsWith("$fn$ LANGUAGE plpgsql;")).toBe(true);
		expect(statements[2]).toBe("SELECT 3;");
	});

	test("ignores positional params like $1 (not dollar quotes)", () => {
		const sql = "SELECT * FROM t WHERE id = $1 AND x = $2;";
		expect(splitSqlStatements(sql)).toEqual(["SELECT * FROM t WHERE id = $1 AND x = $2;"]);
	});

	test("drops segments that contain only comments/whitespace", () => {
		const sql = "SELECT 1;\n-- just a comment\n\n/* block only */\n";
		expect(splitSqlStatements(sql)).toEqual(["SELECT 1;"]);
	});

	test("keeps a final unterminated statement", () => {
		expect(splitSqlStatements("SELECT 1; SELECT 2")).toEqual(["SELECT 1;", "SELECT 2"]);
	});
});
