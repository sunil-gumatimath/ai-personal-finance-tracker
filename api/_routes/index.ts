/**
 * Central route registry. Both the Bun dev server and the Vercel handler
 * resolve routes through this map so the routing rules stay in sync.
 */
import type { ApiRequest, ApiResponse } from "../_utils/types.js";
import authHandler from "./auth.routes.js";
import profileHandler from "./profile.routes.js";
import accountsHandler from "./accounts.routes.js";
import categoriesHandler from "./categories.routes.js";
import transactionsHandler from "./transactions.routes.js";
import budgetsHandler from "./budgets.routes.js";
import goalsHandler from "./goals.routes.js";
import debtsHandler from "./debts.routes.js";
import notificationsHandler from "./notifications.routes.js";
import systemLogsHandler from "./logs.routes.js";
import aiChatHandler from "./ai-chat.routes.js";
import aiInsightsHandler from "./ai-insights.routes.js";
import aiParseHandler from "./ai-parse.routes.js";
import aiDigestHandler from "./ai-digest.routes.js";
import cronHandler from "./cron.routes.js";
import healthHandler from "./health.routes.js";

export type RouteHandler = (
	req: ApiRequest,
	res: ApiResponse,
) => Promise<unknown>;

const ROUTES: Record<string, RouteHandler> = {
	auth: authHandler,
	profile: profileHandler,
	accounts: accountsHandler,
	categories: categoriesHandler,
	transactions: transactionsHandler,
	budgets: budgetsHandler,
	goals: goalsHandler,
	debts: debtsHandler,
	notifications: notificationsHandler,
	"system-logs": systemLogsHandler,
	"ai/chat": aiChatHandler,
	"ai/insights": aiInsightsHandler,
	"ai/parse-transaction": aiParseHandler,
	"ai/digest": aiDigestHandler,
	cron: cronHandler,
	health: healthHandler,
};

/**
 * Resolve a handler for an apiPath like "accounts" or "accounts/123".
 * Falls back to the parent route for dynamic sub-paths (e.g. /api/accounts/:id).
 */
export function resolveRoute(apiPath: string): RouteHandler | null {
	if (ROUTES[apiPath]) return ROUTES[apiPath];

	// Walk up the path segments so deeply-nested dynamic routes
	// (e.g. /api/accounts/123/extra) still resolve to their parent handler.
	const parts = apiPath.split("/");
	for (let len = parts.length - 1; len >= 1; len--) {
		const parent = parts.slice(0, len).join("/");
		if (ROUTES[parent]) return ROUTES[parent];
	}

	return null;
}
