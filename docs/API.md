# API Reference

The API is served under `/api/*` from a single Vercel serverless function
(`api/handler.ts`). The local Bun dev server (`api/_server.ts`) shares the
same route registry, so behavior is identical in development and production.

All endpoints are JSON. Authentication uses an HttpOnly session cookie
(`pft_session`) issued by Neon Auth — no bearer tokens in the client.
Requests without a valid session return `401 { "error": "Unauthorized" }`.

## Conventions

| Pattern | Meaning |
| --- | --- |
| `200` | Success (read / update / delete) |
| `201` | Created |
| `400` | Validation error (`ValidationError`, message is user-safe) |
| `401` | Not authenticated |
| `403` | Origin not allowed (CORS) or resource belongs to another user |
| `404` | Unknown route or missing resource |
| `405` | Method not allowed for that resource |
| `429` | Rate limit exceeded (includes `Retry-After` header) |
| `500` | Internal error — generic `"Server error"` body, details only in logs |

Every user-owned resource is scoped by the authenticated `user_id` server-side;
possessing another user's UUID grants no access.

## Auth

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/auth?action=me` | Current session user |
| POST | `/api/auth?action=login` | Sign in (`email`, `password`) |
| POST | `/api/auth?action=signup` | Register (`email`, `password`, `fullName`) |
| POST | `/api/auth?action=sync` | Update user profile (`fullName`) |
| POST | `/api/auth?action=logout` | End session |
| DELETE | `/api/auth?action=delete-account` | Permanently delete the account |

## Profile & Preferences

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/profile` | Profile + preferences (provider keys sanitized) |
| PATCH | `/api/profile` | Update profile / preferences / currency / AI settings |

## Accounts

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/accounts` | List accounts |
| POST | `/api/accounts` | Create account |
| PUT | `/api/accounts?id=…` | Update account |
| DELETE | `/api/accounts?id=…&cascade=0\|1` | Delete account (optional cascade) |
| GET | `/api/accounts?action=linked-count&accountId=…` | Linked transaction count |

## Categories

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/categories?type=income\|expense` | List categories (optional type filter) |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories?id=…` | Update category |
| DELETE | `/api/categories?id=…` | Delete category |

## Transactions

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/transactions?limit=…&since=…` | List transactions |
| POST | `/api/transactions` | Create transaction (income / expense / transfer) |
| PUT | `/api/transactions?id=…` | Update transaction |
| DELETE | `/api/transactions?id=…` | Delete transaction |

## Budgets

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/budgets` | List budgets |
| POST | `/api/budgets` | Create budget |
| PUT | `/api/budgets?id=…` | Update budget |
| DELETE | `/api/budgets?id=…` | Delete budget |

## Goals

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/goals` | List goals |
| POST | `/api/goals` | Create goal |
| PUT | `/api/goals?id=…` | Update goal |
| DELETE | `/api/goals?id=…` | Delete goal |

## Debts

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/debts` | List debts |
| POST | `/api/debts` | Create debt |
| PUT | `/api/debts?id=…` | Update debt |
| DELETE | `/api/debts?id=…` | Delete debt |
| GET | `/api/debts?action=payments&debtId=…` | List payments for a debt |
| POST | `/api/debts?action=payments` | Record a payment |

## Notifications

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/notifications` | Preferences, budget alerts, recent activity |
| POST | `/api/notifications` | Budget alert or push subscription (`type` in body) |

## AI

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/ai/insights` | Persisted AI insights |
| POST | `/api/ai/insights` | Generate insights (`forceRefresh` optional) |
| PATCH | `/api/ai/insights?id=…` | Dismiss an insight |
| POST | `/api/ai/chat` | Chat message (`message`, `aiPreferences`, `history`) |
| POST | `/api/ai/parse-transaction` | Natural-language transaction extraction (`message`) — validates against the user's own categories/accounts, writes nothing |
| GET | `/api/ai/digest` | Latest stored weekly AI digest |
| POST | `/api/ai/digest` | Generate (or regenerate) this week's AI digest |

## Transactions (recurring)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/transactions?action=process-recurring` | Materialize due recurring occurrences for the signed-in user (returns `{ created, completed }`) |

Recurring templates carry `recurring_frequency`, an optional `recurring_end_date`, and a server-owned `next_due_date`. Each run copies the template into a regular transaction dated `next_due_date` and advances it; series whose end date passed are deactivated. The Vercel Cron job (daily at 03:00 UTC; `/api/cron?action=recurring`, guarded by `CRON_SECRET`) does this for all users; the in-app button does it for one user.

## Cron

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/cron?action=recurring` | Daily maintenance (03:00 UTC): process due recurring transactions for all users. Requires `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically) |

## System

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/system-logs` | Audit log entries (no sensitive payloads) |
| GET | `/api/health` | Liveness probe — unauthenticated, no DB touch |
| WS | `/api/ws-logs` | Real-time audit log stream (local Bun dev server) |

## Neon Auth proxy

`/neon-auth/auth/*` is rewritten to the Neon Auth backend
(`/neondb/auth/*`) for password reset and account flows.
