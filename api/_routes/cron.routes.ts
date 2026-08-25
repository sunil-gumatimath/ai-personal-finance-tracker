import { createHash, timingSafeEqual } from "node:crypto";
import type { ApiRequest, ApiResponse } from "../_utils/types.js";
import {
	listUsersWithDueRecurring,
	processDueRecurringTransactions,
} from "../_services/transactions.service.js";

/**
 * Constant-time comparison of two secrets. Both sides are hashed with
 * SHA-256 first so the inputs always have the same byte length —
 * `timingSafeEqual` throws on length mismatch.
 */
function secretsMatch(a: string, b: string): boolean {
	const ha = createHash("sha256").update(a).digest();
	const hb = createHash("sha256").update(b).digest();
	return timingSafeEqual(ha, hb);
}

/**
 * Cron endpoint for scheduled maintenance jobs.
 *
 * NOT user-authenticated — it is invoked by Vercel Cron with an HTTP GET and
 * `Authorization: Bearer <CRON_SECRET>` (see vercel.json `crons`; schedule is
 * daily at 03:00 UTC), or by any scheduler that knows the secret. POST is
 * accepted too for manual triggering. When `CRON_SECRET` is not configured
 * the endpoint refuses to run (fail-safe: never expose unauthenticated writes).
 *
 * Actions:
 *   GET|POST /api/cron[?action=recurring]  — materialize due recurring
 *       transactions for every user (no AI, cheap; `recurring` is the default
 *       action so a bare `/api/cron` invocation works regardless of how the
 *       scheduler handles the query string).
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
	// Vercel Crons issue GET requests; POST is kept for manual runs.
	if (req.method !== "GET" && req.method !== "POST") {
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
		(bearer.length > 0 && secretsMatch(bearer, expected)) ||
		(headerSecret.length > 0 && secretsMatch(headerSecret, expected));
	if (!authorized) {
		res.status(403).json({ error: "Forbidden" });
		return;
	}

	// Default to the only supported action when the query param is absent.
	const action = req.query?.action || "recurring";

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
