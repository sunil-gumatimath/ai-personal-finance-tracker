import type { ApiRequest, ApiResponse } from "../_utils/types.js";
import {
	listUsersWithDueRecurring,
	processDueRecurringTransactions,
} from "../_services/transactions.service.js";

/**
 * Cron endpoint for scheduled maintenance jobs.
 *
 * NOT user-authenticated — it is invoked by Vercel Cron with
 * `Authorization: Bearer <CRON_SECRET>` (see vercel.json `crons`), or by any
 * scheduler that knows the secret. When `CRON_SECRET` is not configured the
 * endpoint refuses to run (fail-safe: never expose unauthenticated writes).
 *
 * Actions:
 *   POST /api/cron?action=recurring  — materialize due recurring transactions
 *                                      for every user (no AI, cheap, run hourly).
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
	if (req.method !== "POST") {
		res.status(405).json({ error: "Method not allowed" });
		return;
	}

	const expected = process.env.CRON_SECRET?.trim();
	if (!expected) {
		res.status(503).json({
			error:
				"CRON_SECRET is not configured. Set the CRON_SECRET environment variable to enable scheduled jobs.",
		});
		return;
	}

	const authorization = req.headers?.authorization || "";
	const bearer = authorization.startsWith("Bearer ")
		? authorization.slice("Bearer ".length).trim()
		: "";
	const headerSecret = req.headers?.["x-cron-secret"] || "";

	if (!bearer && !headerSecret) {
		res.status(401).json({ error: "Unauthorized" });
		return;
	}

	const authorized =
		(bearer.length > 0 && bearer === expected) ||
		(headerSecret.length > 0 && headerSecret === expected);
	if (!authorized) {
		res.status(403).json({ error: "Forbidden" });
		return;
	}

	const action = req.query?.action;

	if (action === "recurring") {
		try {
			const userIds = await listUsersWithDueRecurring();
			let totalCreated = 0;
			let totalCompleted = 0;
			let usersProcessed = 0;

			for (const userId of userIds) {
				const result = await processDueRecurringTransactions(userId);
				totalCreated += result.created.length;
				totalCompleted += result.completed;
				usersProcessed += 1;
			}

			console.log(
				`[cron:recurring] users=${usersProcessed} created=${totalCreated} completed=${totalCompleted}`,
			);
			res.status(200).json({
				ok: true,
				action: "recurring",
				usersProcessed,
				occurrencesCreated: totalCreated,
				seriesCompleted: totalCompleted,
			});
		} catch (error) {
			console.error("Cron recurring error:", error);
			res.status(500).json({ error: "Server error" });
		}
		return;
	}

	res.status(400).json({
		error: "Unknown cron action. Supported actions: recurring",
	});
}
