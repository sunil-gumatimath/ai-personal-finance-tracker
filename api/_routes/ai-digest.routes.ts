import { getAuthedUserId } from "../_services/auth.service.js";
import { query } from "../_repositories/db.js";
import {
	KiloCodeApiError,
	MissingApiKeyError,
} from "../_services/_ai_ai-provider.js";
import { generateWeeklyDigestContent } from "../_services/digest.service.js";
import type { ApiRequest, ApiResponse } from "../_utils/types.js";
import { sendApiError } from "../_utils/respond.js";

interface DigestRow {
	id: string;
	user_id: string;
	week_start: string;
	content: string;
	created_at: string;
}

/** Monday of the current week (week starts on Monday). */
function getWeekStart(date = new Date()): string {
	const d = new Date(date);
	const day = d.getDay(); // 0 = Sunday
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${dd}`;
}

/**
 * AI weekly digest: `GET /api/ai/digest` returns the latest stored digest;
 * `POST /api/ai/digest` generates (or regenerates) one for the current week
 * from the last 7 days of data and persists it.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
	const userId = await getAuthedUserId(req);
	if (!userId) {
		res.status(401).json({ error: "Unauthorized" });
		return;
	}

	if (req.method === "GET") {
		try {
			const { rows } = await query<DigestRow>(
				`SELECT * FROM ai_digests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
				[userId],
			);
			res.status(200).json({ digest: rows[0] || null });
		} catch (error) {
			console.error("AI digest GET error:", error);
			sendApiError(res, error);
		}
		return;
	}

	if (req.method === "POST") {
		try {
			const content = await generateWeeklyDigestContent(userId);
			const weekStart = getWeekStart();

			// Upsert the digest for this week.
			const { rows } = await query<DigestRow>(
				`INSERT INTO ai_digests (user_id, week_start, content)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, week_start)
         DO UPDATE SET content = EXCLUDED.content, created_at = NOW()
         RETURNING *`,
				[userId, weekStart, content],
			);

			res.status(200).json({ digest: rows[0] || null });
		} catch (error) {
			console.error("AI digest POST error:", error);

			if (error instanceof MissingApiKeyError) {
				res.status(400).json({ error: error.message });
			} else if (error instanceof KiloCodeApiError) {
				const status =
					Number.isInteger(error.status) &&
					error.status >= 400 &&
					error.status <= 599
						? error.status
						: 502;
				res.status(status).json({ error: error.message });
			} else {
				sendApiError(res, error);
			}
		}
		return;
	}

	res.status(405).json({ error: "Method not allowed" });
}
