/**
 * Apply SQL migrations to the Neon database.
 *
 * Usage:
 *   bun scripts/migrate.ts                          # apply all files in database/migrations (filename order)
 *   bun scripts/migrate.ts <path-to-sql-file>       # apply a single file
 *   bun scripts/migrate.ts <path> --force           # re-apply even if the ledger records it as applied
 *
 * Reads NEON_DATABASE_URL from .env (Bun auto-loads it).
 *
 * Statements are split with a dollar-quote-aware scanner (see
 * scripts/lib/sql-splitter.ts) so plpgsql `$$ ... $$` bodies survive intact;
 * each statement is sent separately because the Neon HTTP driver executes one
 * statement per request (auto-commit).
 *
 * A `schema_migrations` ledger table records which file versions have been
 * applied; already-recorded files are skipped. DDL in this project is written
 * to be idempotent, so a partial run can be safely re-run after fixing the
 * underlying problem.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { splitSqlStatements } from "./lib/sql-splitter";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "database", "migrations");

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------
const force = process.argv.includes("--force");
const positionalArgs = process.argv.slice(2).filter((a) => a !== "--force");

if (positionalArgs.length > 1) {
	console.error("Usage: bun scripts/migrate.ts [path-to-sql-file] [--force]");
	process.exit(1);
}

const url = process.env.NEON_DATABASE_URL;
if (!url) {
	console.error("NEON_DATABASE_URL is not set (check .env)");
	process.exit(1);
}

type MigrationFile = { path: string; version: string };

function collectFiles(): MigrationFile[] {
	if (positionalArgs.length === 1) {
		const path = resolve(positionalArgs[0]);
		return [{ path, version: stripSqlExtension(basename(path)) }];
	}
	return readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort()
		.map((f) => ({ path: join(MIGRATIONS_DIR, f), version: stripSqlExtension(f) }));
}

function stripSqlExtension(filename: string): string {
	return filename.replace(/\.sql$/i, "");
}

function firstLine(statement: string): string {
	return statement.split("\n")[0].slice(0, 90);
}

const sql = neon(url, { fullResults: true });

// ---------------------------------------------------------------------------
// Migration ledger
// ---------------------------------------------------------------------------
await sql.query(
  `CREATE TABLE IF NOT EXISTS schema_migrations (
     version TEXT PRIMARY KEY,
     applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
);

const appliedRows = await sql.query("SELECT version FROM schema_migrations");
const appliedVersions = new Set(
  (appliedRows.rows as Array<{ version: string }>).map((r) => r.version),
);

// ---------------------------------------------------------------------------
// Apply migrations
// ---------------------------------------------------------------------------
const files = collectFiles();
let applied = 0;
let skipped = 0;

for (const file of files) {
  if (appliedVersions.has(file.version) && !force) {
    console.log(`⏭ ${file.version} already recorded in schema_migrations — skipping.`);
    skipped += 1;
    continue;
  }

  const contents = readFileSync(file.path, "utf8");
  const statements = splitSqlStatements(contents);

  console.log(`▶ ${file.version}: applying ${statements.length} statement(s) ...`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    try {
      await sql.query(statement);
      console.log(`  ✓ [${i + 1}/${statements.length}] ${firstLine(statement)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("");
      console.error(`  ✗ FAILED statement [${i + 1}/${statements.length}] of ${file.version}:`);
      console.error(`  --- statement --------------------------------------`);
      console.error(statement.length > 600 ? `${statement.slice(0, 600)}\n  ... (truncated)` : statement);
      console.error(`  ----------------------------------------------------`);
      console.error(`  Error: ${message}`);
      // The HTTP driver auto-commits every statement: everything before this
      // point in the file is already committed and cannot be rolled back.
      if (i > 0) {
        console.error(
          `  Note: statements [1..${i}] of this file were applied successfully` +
            ` in this run and are COMMITTED.`,
        );
      }
      console.error(
        `  Re-run "bun scripts/migrate.ts" after fixing; all migration DDL is` +
          ` idempotent, so re-running is safe.`,
      );
      process.exit(1);
    }
  }

  await sql.query(
    "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
    [file.version],
  );
  applied += 1;
}

console.log(
  `Done. Applied ${applied} file(s), skipped ${skipped} already-recorded file(s).`,
);
