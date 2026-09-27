/**
 * Safe query builder utilities to prevent SQL injection
 */

import { ValidationError } from "../_errors/AppError.js";

// Allowed column names for each table to prevent SQL injection
const ALLOWED_COLUMNS: Record<string, string[]> = {
	accounts: [
		"name",
		"type",
		// `balance` is allowed here ONLY as an opening balance on INSERT.
		//
		// It is a materialized running total maintained by the
		// `update_account_balance` trigger on `transactions` (migration 001).
		// A manual *correction* was silently destroyed by the next transaction
		// on that account: correct Checking from ₹200 to ₹5,000, record a ₹100
		// expense, and the trigger computed `5000 - 100 = 4900` — the
		// correction vanished with no warning.
		//
		// So `accounts.service` rejects `balance` on update with an explicit
		// error rather than letting the builder drop it silently. Creating an
		// account that already exists in the real world legitimately needs to set
		// an opening balance, so the create path still passes it through.
		"balance",
		"currency",
		"color",
		"icon",
		"is_active",
	],
	transactions: [
		"type",
		"amount",
		"description",
		"date",
		"category_id",
		"account_id",
		"to_account_id",
		"notes",
		"is_recurring",
		"recurring_frequency",
		"recurring_end_date",
		// next_due_date is SERVER-OWNED: sanitizeRecurringInput deletes any
		// client-supplied value and recomputes it from date + frequency, so it
		// is safe to write through the generic builder. recurring_parent_id is
		// intentionally NOT in this list — only the recurring-processing code
		// writes it, via raw SQL.
		"next_due_date",
	],
	categories: ["name", "type", "color", "icon", "parent_id"],
	budgets: ["category_id", "amount", "period", "start_date", "end_date"],
	goals: [
		"name",
		"target_amount",
		"current_amount",
		"deadline",
		"color",
		"icon",
	],
	debts: [
		"name",
		"type",
		"original_amount",
		"current_balance",
		"interest_rate",
		"minimum_payment",
		"due_day",
		"start_date",
		"end_date",
		"lender",
		"is_active",
		"notes",
		"color",
		"icon",
	],
	debt_payments: [
		"debt_id",
		"amount",
		"payment_date",
		"notes",
		"principal_amount",
		"interest_amount",
	],
	profiles: ["full_name", "avatar_url", "currency", "preferences"],
	users: ["full_name", "avatar_url"],
};

// Maximum input lengths per table/field to prevent DoS
const MAX_LENGTHS: Record<string, Record<string, number>> = {
	accounts: { name: 100, description: 500 },
	transactions: { description: 500, notes: 2000 },
	categories: { name: 100, description: 500 },
	budgets: {},
	goals: { name: 100, description: 500 },
	debts: { name: 100, notes: 2000, lender: 100 },
	debt_payments: { notes: 500 },
	profiles: { full_name: 100, avatar_url: 500 },
	users: { full_name: 100, avatar_url: 500 },
};

/**
 * Validates that input string values do not exceed maximum lengths.
 * Throws ValidationError so sendApiError maps it to a 400 response.
 */
function validateInputLengths(
	table: string,
	data: Record<string, unknown>,
): void {
	const limits = MAX_LENGTHS[table];
	if (!limits) return;
	for (const [key, value] of Object.entries(data)) {
		if (
			typeof value === "string" &&
			limits[key] &&
			value.length > limits[key]
		) {
			throw new ValidationError(
				`Field '${key}' exceeds maximum length of ${limits[key]} characters`,
			);
		}
	}
}

/** Server-side identifier pattern for generated column keys. */
const IDENTIFIER_REGEX = /^[a-z_][a-z0-9_]*$/;

/**
 * Validates that column names are allowed for the given table.
 * Throws ValidationError so sendApiError maps it to a 400 response.
 */
function validateColumns(table: string, columns: string[]): string[] {
	const allowed = ALLOWED_COLUMNS[table];
	if (!allowed) {
		throw new ValidationError(`Unknown resource type: ${table}`);
	}

	const invalid = columns.filter((col) => !allowed.includes(col));
	if (invalid.length > 0) {
		throw new ValidationError("One or more fields are not allowed");
	}

	return columns;
}

/**
 * Renumber `$n` placeholders in a caller-supplied WHERE clause to sit after the
 * SET/INSERT values.
 *
 * Two guards, both latent-footgun fixes rather than live bugs (every call site
 * passes a literal clause with a matching parameter count):
 *
 *  - The clause may only reference `$1 .. $paramCount`. Without this, a clause
 *    mentioning `$3` with two params would silently renumber to a placeholder
 *    that no longer exists.
 *  - A `$n` inside a single-quoted string literal is left alone, so a literal
 *    like `'cost $2'` is not rewritten.
 *
 * Implemented as a single scan rather than chained `.replace()` calls, because
 * `String.replace` with a function does not expose the current match's index,
 * and a naive "count quotes before this match" approach reads the wrong offset
 * for any repeated placeholder.
 */
function offsetPlaceholders(
	whereClause: string,
	offset: number,
	paramCount: number,
): string {
	const TOKEN = /'(?:[^']|'')*'|\$(\d+)/g;
	let out = "";
	let last = 0;
	let match: RegExpExecArray | null;

	while ((match = TOKEN.exec(whereClause)) !== null) {
		out += whereClause.slice(last, match.index);
		if (match[1] === undefined) {
			// A quoted literal — copy through untouched.
			out += match[0];
		} else {
			const n = parseInt(match[1], 10);
			if (n < 1 || n > paramCount) {
				throw new ValidationError("Invalid query parameter reference");
			}
			out += `$${n + offset}`;
		}
		last = match.index + match[0].length;
	}
	out += whereClause.slice(last);
	return out;
}

/**
 * Builds a safe UPDATE query with parameterized values
 */
export function buildUpdateQuery(
	table: string,
	data: Record<string, unknown>,
	whereClause: string,
	whereParams: unknown[],
): { text: string; values: unknown[] } | null {
	// Filter out user_id and validate columns
	const keys = Object.keys(data).filter((k) => k !== "user_id" && k !== "id");

	if (keys.length === 0) {
		return null; // No valid fields to update
	}

	// Validate columns against allowed list
	validateColumns(table, keys);
	// Validate input lengths
	validateInputLengths(table, data);

	const values = keys.map((k) => data[k]);
	const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");

	// Add WHERE params after SET params
	const whereParamOffset = keys.length;
	const adjustedWhereClause = offsetPlaceholders(
		whereClause,
		whereParamOffset,
		whereParams.length,
	);

	const text = `UPDATE "${table}" SET ${setClause} WHERE ${adjustedWhereClause} RETURNING *`;

	return { text, values: [...values, ...whereParams] };
}

/**
 * Builds a safe INSERT query with parameterized values
 */
export function buildInsertQuery(
	table: string,
	data: Record<string, unknown>,
	additionalColumns?: Record<string, unknown>,
): { text: string; values: unknown[] } {
	// Filter out user_id from data (it will be added separately)
	const keys = Object.keys(data).filter((k) => k !== "user_id" && k !== "id");

	// Validate columns against allowed list
	validateColumns(table, keys);
	// Validate input lengths
	validateInputLengths(table, data);

	const values = keys.map((k) => data[k]);

	// Add additional columns (like user_id). These are server-supplied, but
	// still validate the keys so nothing unexpected can reach the SQL text.
	const extraKeys: string[] = [];
	if (additionalColumns) {
		Object.entries(additionalColumns).forEach(([key, value]) => {
			if (!IDENTIFIER_REGEX.test(key)) {
				throw new ValidationError("Invalid insert column name");
			}
			extraKeys.push(key);
			values.push(value);
		});
	}

	// A payload containing nothing but `user_id`/`id` used to build
	// `INSERT INTO "x" () VALUES () RETURNING *` — a syntax error reported as an
	// opaque 500. Reject it as the client error it is.
	const allKeys = [...keys, ...extraKeys];
	if (allKeys.length === 0) {
		throw new ValidationError("No valid fields to create");
	}

	const columns = allKeys.map((k) => `"${k}"`).join(", ");
	const placeholders = allKeys.map((_, i) => `$${i + 1}`).join(", ");
	const text = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING *`;

	return { text, values };
}
