/**
 * Central route registry. Both the Bun dev server and the Vercel handler
 * resolve routes through this map so the routing rules stay in sync.
 */
import type { ApiRequest, ApiResponse } from '../utils/types.js'
import authHandler from '../handlers/auth.js'
import profileHandler from '../handlers/profile.js'
import accountsHandler from '../handlers/accounts.js'
import categoriesHandler from '../handlers/categories.js'
import transactionsHandler from '../handlers/transactions.js'
import budgetsHandler from '../handlers/budgets.js'
import goalsHandler from '../handlers/goals.js'
import debtsHandler from '../handlers/debts.js'
import notificationsHandler from '../handlers/notifications.js'
import systemLogsHandler from '../handlers/system-logs.js'
import aiChatHandler from '../handlers/ai/chat.js'
import aiInsightsHandler from '../handlers/ai/insights.js'
import healthHandler from '../handlers/health.js'

export type RouteHandler = (req: ApiRequest, res: ApiResponse) => Promise<unknown>

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
  'system-logs': systemLogsHandler,
  'ai/chat': aiChatHandler,
  'ai/insights': aiInsightsHandler,
  health: healthHandler,
}

/**
 * Resolve a handler for an apiPath like "accounts" or "accounts/123".
 * Falls back to the parent route for dynamic sub-paths (e.g. /api/accounts/:id).
 */
export function resolveRoute(apiPath: string): RouteHandler | null {
  if (ROUTES[apiPath]) return ROUTES[apiPath]

  const parts = apiPath.split('/')
  if (parts.length > 1) {
    const parent = parts.slice(0, -1).join('/')
    if (ROUTES[parent]) return ROUTES[parent]
  }

  return null
}

/** Returns true if any registered route matches the given prefix. */
export function isKnownRoutePrefix(apiPath: string): boolean {
  if (ROUTES[apiPath]) return true
  const parts = apiPath.split('/')
  if (parts.length > 1) {
    const parent = parts.slice(0, -1).join('/')
    if (ROUTES[parent]) return true
  }
  return false
}

export { ROUTES }
