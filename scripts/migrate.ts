/**
 * Apply a SQL migration file to the Neon database.
 *
 * Usage:
 *   bun scripts/migrate.ts database/migrations/005_recurring_and_digests.sql
 *
 * Reads NEON_DATABASE_URL from .env (Bun auto-loads it). Statements are
 * split on ";" at end of line, so each statement is sent separately — the
 * Neon HTTP driver executes one statement per request.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const file = process.argv[2];
if (!file) {
	console.error("Usage: bun scripts/migrate.ts <path-to-sql-file>");
	process.exit(1);
}

const url = process.env.NEON_DATABASE_URL;
if (!url) {
	console.error("NEON_DATABASE_URL is not set (check .env)");
	process.exit(1);
}

const sql = neon(url, { fullResults: true });
const contents = readFileSync(file, "utf8");

// Split into statements on ';' at end of line (this migration set has no
// semicolons inside string literals).
const statements = contents
	.split(/;\s*\r?\n/)
	.map((s) => s.trim())
	.filter(Boolean);

console.log(`Applying ${statements.length} statement(s) from ${file} ...`);

for (const statement of statements) {
	try {
		await sql.query(statement);
		console.log(`  ✓ ${statement.split("\n")[0].slice(0, 90)}`);
	} catch (error) {
		console.error(`  ✗ Failed:\n${statement.slice(0, 300)}`);
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

console.log("Migration applied successfully.");
