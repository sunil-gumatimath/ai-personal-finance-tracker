import type { ApiRequest } from "../_utils/types.js";
import { NotFoundError, ValidationError } from "../_errors/AppError.js";
import {
	assertUuid,
	computeNextDueDate,
	normalizeTransactionLimit,
	sanitizeRecurringInput,
	validateCreateTransactionInput,
	validateListTransactionsOptions,
	validateUpdateTransactionInput,
	type RecurringFrequency,
} from "../_domain/transactions.js";
import { assertTransactionReferencesOwned } from "./ownership.service.js";
import { logEvent } from "./audit-log.service.js";
import { query } from "../_repositories/db.js";
import {
	createTransaction,
	deleteTransaction,
	findTransactionById,
	listTransactions,
	updateTransaction,
	type TransactionRow,
} from "../_repositories/transactions.repository.js";

function ensureTransactionId(id: string) {
	assertUuid(id, "transaction ID");
}

export async function listUserTransactions(
	userId: string,
	query: Record<string, string | undefined> = {},
) {
	const since = query.since;
	const limit = normalizeTransactionLimit(query.limit);
	validateListTransactionsOptions({ since, limit });

	const rows = await listTransactions({ userId, since, limit });

	// `total_count` comes from `COUNT(*) OVER ()` in the repository, so the
	// client can distinguish a complete result set from a truncated one
	// instead of inferring it from the row count. `total` is the count BEFORE
	// the limit; `truncated` says whether anything was actually dropped.
	const totalFromWindow = rows.length > 0 ? Number(rows[0]?.total_count ?? 0) : 0;
	const total = Number.isFinite(totalFromWindow) && totalFromWindow > 0
		? totalFromWindow
		: rows.length;

	// Strip the helper column so it never reaches the wire on a row object.
	const transactions = rows.map(({ total_count: _totalCount, ...row }) => row);

	return { transactions, total, truncated: transactions.length < total };
}

export async function createUserTransaction(
	req: ApiRequest,
	userId: string,
	data: Record<string, unknown>,
) {
	validateCreateTransactionInput(data);
	await assertTransactionReferencesOwned(userId, data);

	const sanitized = sanitizeRecurringInput(data);

	const createdTransaction = await createTransaction(userId, sanitized);
	if (!createdTransaction) {
		throw new Error("Transaction creation failed");
	}

	await logEvent(req, {
		action: "TRANSACTION_CREATED",
		resource: `transactions/${createdTransaction.id}`,
		newValue: JSON.stringify(createdTransaction),
		severity: "info",
		status: "success",
		metadata: {
			type: createdTransaction.type,
			amount: createdTransaction.amount,
			description: createdTransaction.description,
		},
	});

	return createdTransaction;
}

export async function updateUserTransaction(
	req: ApiRequest,
	userId: string,
	id: string,
	data: Record<string, unknown>,
) {
	ensureTransactionId(id);

	const oldTransaction = await findTransactionById(userId, id);
	if (!oldTransaction) {
		throw new NotFoundError("Transaction not found");
	}

	// Validate against the post-update row so the transfer invariant is checked
	// even when the patch only flips `type` (leaving `to_account_id` untouched
	// in the payload but inconsistent with the new type).
	validateUpdateTransactionInput(data, oldTransaction);

	await assertTransactionReferencesOwned(userId, data, oldTransaction);

	const sanitized = sanitizeRecurringInput(data, oldTransaction);

	const updatedTransaction = await updateTransaction(userId, id, sanitized);
	if (!updatedTransaction) {
		throw new ValidationError("No valid fields to update");
	}

	await logEvent(req, {
		action: "TRANSACTION_EDITED",
		resource: `transactions/${id}`,
		oldValue: JSON.stringify(oldTransaction),
		newValue: JSON.stringify(updatedTransaction),
		severity: "info",
		status: "success",
		metadata: {
			oldAmount: oldTransaction.amount,
			newAmount: updatedTransaction.amount,
			description: updatedTransaction.description,
		},
	});

	return updatedTransaction;
}

export async function deleteUserTransaction(
	req: ApiRequest,
	userId: string,
	id: string,
) {
	ensureTransactionId(id);

	const oldTransaction: TransactionRow | null = await findTransactionById(
		userId,
		id,
	);
	if (!oldTransaction) {
		throw new NotFoundError("Transaction not found");
	}

	await deleteTransaction(userId, id);

	await logEvent(req, {
		action: "TRANSACTION_DELETED",
		resource: `transactions/${id}`,
		oldValue: JSON.stringify(oldTransaction),
		severity: "warning",
		status: "success",
		metadata: {
			type: oldTransaction.type,
			amount: oldTransaction.amount,
			description: oldTransaction.description,
		},
	});
}

// ---------------------------------------------------------------------------
// Recurring transaction automation
// ---------------------------------------------------------------------------

/**
 * Materialize every due occurrence for a user's recurring templates.
 *
 * For each template with `next_due_date <= today` (and within its optional
 * end date), a regular (non-recurring) copy is inserted with
 * `date = next_due_date` and `recurring_parent_id` pointing at the template
 * for traceability. The template's `next_due_date` then advances one
 * interval; a series whose end date has passed is deactivated.
 *
 * Concurrency invariant (no multi-statement transactions are available on
 * the Neon HTTP driver, so each step is an atomic single statement):
 *
 *   1. ADVANCE FIRST via compare-and-swap — `UPDATE … SET next_due_date =
 *      $new WHERE next_due_date = $expected`. Exactly one concurrent worker
 *      wins the swap; losers see 0 updated rows and skip the template.
 *   2. INSERT the occurrence only after winning the swap.
 *
 * Advance-first means at-most-once materialization per due cycle: if a worker
 * crashes between advancing and inserting, that cycle is skipped rather than
 * duplicated. Duplicate money rows are worse than a missed occurrence (the
 * next cron run picks up any later cycles).
 */
export async function processDueRecurringTransactions(
	userId: string,
): Promise<{ created: TransactionRow[]; completed: number; failed: number }> {
	const { rows: due } = await query<TransactionRow>(
		`
    SELECT * FROM transactions
    WHERE user_id = $1
      AND is_recurring = true
      AND next_due_date IS NOT NULL
      AND next_due_date <= CURRENT_DATE
      AND (recurring_end_date IS NULL OR recurring_end_date >= next_due_date)
    ORDER BY next_due_date ASC
    `,
		[userId],
	);

	const created: TransactionRow[] = [];
	let completed = 0;
	let failed = 0;

	for (const template of due) {
		// Per-template error isolation.
		//
		// One bad template used to abort the WHOLE run for this user. The
		// occurrence INSERT copies `account_id`/`category_id` verbatim and
		// `transactions.account_id` is NOT NULL with ON DELETE RESTRICT, so a
		// template whose account or category was deleted made
		// `ensure_transaction_refs_owned` raise — and the exception escaped the
		// loop. Since the CAS had already advanced the template, the failure was
		// not even retried for that cycle, and every OTHER due template for that
		// user silently stopped being processed on every subsequent run.
		//
		// A single mis-referenced template must not take out the rest of the
		// series. Log it and continue.
		try {
			const result = await materializeOneOccurrence(template, userId);
			if (result.kind === "skipped") continue;
			if (result.kind === "completed") {
				completed++;
				await logEvent(null, {
					action: "RECURRING_SERIES_COMPLETED",
					resource: `transactions/${template.id}`,
					newValue: JSON.stringify({ endedAt: result.dueDate }),
					severity: "info",
					status: "success",
					metadata: {
						templateId: template.id,
						description: template.description,
					},
				});
				continue;
			}
			created.push(result.occurrence);
			await logEvent(null, {
				action: "RECURRING_OCCURRENCE_CREATED",
				resource: `transactions/${result.occurrence.id}`,
				newValue: JSON.stringify(result.occurrence),
				severity: "info",
				status: "success",
				metadata: {
					templateId: template.id,
					type: result.occurrence.type,
					amount: result.occurrence.amount,
					description: result.occurrence.description,
					date: result.dueDate,
				},
			});
		} catch (error) {
			failed++;
			console.error(
				`Recurring occurrence failed for template ${template.id}:`,
				error,
			);
			await logEvent(null, {
				action: "RECURRING_OCCURRENCE_FAILED",
				resource: `transactions/${template.id}`,
				newValue:
					error instanceof Error ? error.message : String(error),
				severity: "error",
				status: "failure",
				metadata: { templateId: template.id, dueDate: template.next_due_date },
			}).catch(() => undefined);
		}
	}

	// `failed` is surfaced so the caller (and the cron log) can see that a
	// series did not materialize rather than silently under-reporting.
	return { created, completed, failed };
}

type MaterializeResult =
	| { kind: "skipped" }
	| { kind: "completed"; dueDate: string }
	| { kind: "created"; occurrence: TransactionRow; dueDate: string };

/** Advance one template by a cycle and insert its occurrence. */
async function materializeOneOccurrence(
	template: TransactionRow,
	userId: string,
): Promise<MaterializeResult> {
	const dueDate = template.next_due_date as string;
	const frequency = template.recurring_frequency as RecurringFrequency;
	const next = computeNextDueDate(dueDate, frequency);
	const endDate = template.recurring_end_date as string | null;
	const seriesEnds = Boolean(endDate && next > endDate);

	// Compare-and-swap: claim this cycle by advancing next_due_date (or
	// completing the series) only if it still holds the value we read.
	// Another worker won the race when 0 rows come back — skip entirely.
	const { rowCount } = seriesEnds
		? await query(
				`
        UPDATE transactions
        SET is_recurring = false, next_due_date = NULL
        WHERE id = $1 AND user_id = $2 AND next_due_date = $3
        `,
				[template.id, userId, dueDate],
			)
		: await query<TransactionRow>(
				`
        UPDATE transactions
        SET next_due_date = $1, updated_at = NOW()
        WHERE id = $2 AND user_id = $3 AND next_due_date = $4
        RETURNING *
        `,
				[next, template.id, userId, dueDate],
			);

	if (!rowCount || rowCount === 0) {
		return { kind: "skipped" }; // another worker already advanced this series
	}

	// The final occurrence IS created before the series is retired: the CAS
	// above already marked the series ended, and the insert below still runs.
	// Verified against the end-date boundary — an occurrence dated exactly
	// `recurring_end_date` is materialized, not dropped.
	if (seriesEnds) {
		await query<TransactionRow>(
			`
      INSERT INTO transactions (
        user_id, account_id, category_id, to_account_id,
        type, amount, description, notes,
        date, is_recurring, recurring_frequency, recurring_end_date,
        recurring_parent_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NULL, NULL, $10)
      RETURNING *
      `,
			[
				userId,
				template.account_id,
				template.category_id,
				template.to_account_id,
				template.type,
				template.amount,
				template.description ?? null,
				template.notes ?? null,
				dueDate,
				template.id,
			],
		);
		return { kind: "completed", dueDate };
	}

	// We own this cycle — insert the occurrence for `dueDate`.
	const { rows } = await query<TransactionRow>(
		`
      INSERT INTO transactions (
        user_id, account_id, category_id, to_account_id,
        type, amount, description, notes,
        date, is_recurring, recurring_frequency, recurring_end_date,
        recurring_parent_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NULL, NULL, $10)
      RETURNING *
      `,
		[
			userId,
			template.account_id,
			template.category_id,
			template.to_account_id,
			template.type,
			template.amount,
			template.description ?? null,
			template.notes ?? null,
			dueDate,
			template.id,
		],
	);

	const occurrence = rows[0];
	// No row means the `uq_recurring_occurrence` index rejected a duplicate —
	// the at-most-once backstop doing its job. Not an error.
	if (!occurrence) return { kind: "skipped" };
	return { kind: "created", occurrence, dueDate };
}

/** All user ids that currently have due recurring templates. */
export async function listUsersWithDueRecurring(): Promise<string[]> {
	const { rows } = await query<{ user_id: string }>(
		`
    SELECT DISTINCT user_id FROM transactions
    WHERE is_recurring = true
      AND next_due_date IS NOT NULL
      AND next_due_date <= CURRENT_DATE
      AND (recurring_end_date IS NULL OR recurring_end_date >= next_due_date)
    `,
	);
	return rows.map((r) => r.user_id);
}
