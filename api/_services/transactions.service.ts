import type { ApiRequest } from "../_utils/types.js";
import { NotFoundError, ValidationError } from "../_errors/AppError.js";
import {
	assertUuid,
	computeNextDueDate,
	normalizeTransactionLimit,
	sanitizeRecurringInput,
	validateCreateTransactionInput,
	validateListTransactionsOptions,
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

	return await listTransactions({ userId, since, limit });
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
 * Safe to run repeatedly: advancing `next_due_date` is what prevents
 * double-creation, so overlapping cron invocations cannot duplicate rows.
 */
export async function processDueRecurringTransactions(
	userId: string,
): Promise<{ created: TransactionRow[]; completed: number }> {
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

	for (const template of due) {
		const dueDate = template.next_due_date as string;
		const frequency = template.recurring_frequency as RecurringFrequency;

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
		if (occurrence) {
			created.push(occurrence);
			await logEvent(null, {
				action: "RECURRING_OCCURRENCE_CREATED",
				resource: `transactions/${occurrence.id}`,
				newValue: JSON.stringify(occurrence),
				severity: "info",
				status: "success",
				metadata: {
					templateId: template.id,
					type: occurrence.type,
					amount: occurrence.amount,
					description: occurrence.description,
					date: dueDate,
				},
			});
		}

		const next = computeNextDueDate(dueDate, frequency);
		const endDate = template.recurring_end_date as string | null;
		if (endDate && next > endDate) {
			await query(
				`UPDATE transactions SET is_recurring = false, next_due_date = NULL
         WHERE id = $1 AND user_id = $2`,
				[template.id, userId],
			);
			completed++;
			await logEvent(null, {
				action: "RECURRING_SERIES_COMPLETED",
				resource: `transactions/${template.id}`,
				newValue: JSON.stringify({ endedAt: dueDate }),
				severity: "info",
				status: "success",
				metadata: {
					templateId: template.id,
					description: template.description,
				},
			});
		} else {
			await query(
				`UPDATE transactions SET next_due_date = $1 WHERE id = $2 AND user_id = $3`,
				[next, template.id, userId],
			);
		}
	}

	return { created, completed };
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
