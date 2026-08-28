# API Reference

The API is served under `/api/*` from a single Vercel serverless function
(`api/handler.ts`). The local Bun dev server (`api/_server.ts`) shares the
same route registry, so behavior is identical in development and production.

Unless noted otherwise, endpoints return JSON. Authentication uses an HttpOnly session cookie
(`pft_session`, `SameSite=Strict`, `Secure` in production) issued by Neon Auth —
no bearer tokens in the client. Requests without a valid session return
`401 { "error": "Unauthorized" }` (the cron route is the exception: it
authenticates with `CRON_SECRET`).

## Conventions

| Pattern | Meaning |
| --- | --- |
| `200` | Success (read / update / delete) |
| `201` | Created |
| `400` | Validation error (`ValidationError`, message is user-safe) |
| `401` | Not authenticated |
| `403` | Origin not allowed (CORS) or request forbidden (e.g. invalid `CRON_SECRET`) |
| `404` | Unknown route or missing resource (a resource owned by another user reads as 404, never 403) |
| `405` | Method not allowed for that resource |
| `422` | Unprocessable input (AI could not parse/understand the request) |
| `429` | Rate limit exceeded — `{ "error": "Rate limit exceeded…" }` body plus `Retry-After` header |
| `500` | Internal error — generic `"Server error"` body, details only in logs |
| `502` | Upstream auth provider failed to create a session |
| `503` | Service unavailable (e.g. `CRON_SECRET` unset, or external AI provider unreachable) |

Every user-owned resource is scoped by the authenticated `user_id` server-side;
possessing another user's UUID grants no access.

Errors thrown as `AppError` subclasses map to their status code
(`ValidationError` → 400 with a user-safe message, `NotFoundError` → 404);
anything else is a generic 500. Rate limiting: AI endpoints are limited to
20 req/min per client IP (auth login/signup are stricter at 5/min inside
`auth.routes.ts`, and failed logins count triple); exceeding either blocks the
client for 15 minutes.

## Auth

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/auth?action=me` | Current session user (401 if session invalid/expired) |
| POST | `/api/auth?action=login` | Sign in (`email`, `password`) — rate limited, 5 attempts/min then 15 min block |
| POST | `/api/auth?action=signup` | Register (`email`, `password`, `fullName`) — rate limited like login; seeds default categories |
| POST | `/api/auth?action=sync` | Update profile after sign-in (`fullName`) and ensure default categories exist |
| POST | `/api/auth?action=logout` | End session (clears the cookie) |
| DELETE | `/api/auth?action=delete-account` | Permanently wipe all data + auth identity |

## Profile & Preferences

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/profile` | Profile + preferences (API keys sanitized out of the response) |
| PATCH | `/api/profile` | Update profile / preferences / AI settings — accepts `preferences`, `apiKeys` (e.g. `kilocodeApiKey`, `null` clears it), `currency` (ISO code), optional `full_name`, `avatar_url` |

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
| GET | `/api/transactions?limit=…&since=…` | List transactions (`limit` 1–1000, `since` = `YYYY-MM-DD`) |
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
| GET | `/api/debts?action=payments&debtId=…` | List payments for a debt (`debtId` required) |
| POST | `/api/debts?action=payments` | Record a payment — returns `{ payment, debt }` with the post-payment debt balance; overpayment is a 400 |

## Notifications

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/notifications` | Preferences, active budget alerts (warning at ≥80%, over at ≥100%), recent activity |
| POST | `/api/notifications` | `type: "budget_alert"` (`message`, `severity`) or `"push_notification"` — acknowledged, not persisted |

## AI

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/ai/insights` | Active (non-dismissed) AI insights from the last 7 days |
| POST | `/api/ai/insights` | Generate insights (`forceRefresh: true` bypasses reuse of recent ones); rule-based fallback when no AI key is set, so no key is required |
| PATCH | `/api/ai/insights?id=…` | Dismiss an insight |
| POST | `/api/ai/chat` | Chat message (`message` ≤ 4000 chars, optional `aiPreferences.aiProvider`, optional `history`) |
| POST | `/api/ai/chat` (streaming) | Same body with `Accept: text/event-stream` — reply streams as newline-delimited JSON events: `{"type":"delta","text":"…"}` per token, then `{"type":"done"}`, or `{"type":"error","message":"…"}` on any failure (including 401/400, which are in-band once the stream has started). Falls back to buffered JSON when the header is absent |
| POST | `/api/ai/parse-transaction` | Natural-language transaction extraction (`message` ≤ 500 chars, optional `aiPreferences`) — validates against the user's own categories/accounts, writes nothing; returns 422 if unparseable |
| GET | `/api/ai/digest` | Latest stored weekly AI digest |
| POST | `/api/ai/digest` | Generate (or regenerate) this week's AI digest from the last 7 days of data |

AI chat, parse-transaction, and digest require a KiloCode API key (stored in
preferences or `KILOCODE_API_KEY` env); missing keys return 400. The **insights**
endpoint is the exception: when no key is configured it falls back to rule-based
anomaly/coaching detection and returns 200 instead of erroring. Only free models are
allowed; a disallowed saved model falls back to the server default instead of erroring.
All four AI endpoints are rate limited to 20 req/min per IP (per distinct AI path).

## Transactions (recurring)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/transactions?action=process-recurring` | Materialize due recurring occurrences for the signed-in user (returns `{ created, completed }`) |

Recurring templates carry `recurring_frequency`, an optional `recurring_end_date`, and a server-owned `next_due_date`. Each run copies the template into a regular transaction dated `next_due_date` and advances it; series whose end date passed are deactivated. The Vercel Cron job (daily at 03:00 UTC; `/api/cron?action=recurring`, guarded by `CRON_SECRET`) does this for all users; the in-app button does it for one user.

## Cron

| Method | Path | Description |
| --- | --- | --- |
| GET/POST | `/api/cron?action=recurring` | Daily maintenance (03:00 UTC per `vercel.json`): materialize due recurring transactions for every user. `action=recurring` is the default and may be omitted. Requires `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this) or an `x-cron-secret` header — 401 if absent, 403 if wrong, 503 if unset |

## System

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/system-logs?severity=…&action=…&days=…&limit=…` | Audit log entries across all event types. Optional filters: `severity` in `info\|warning\|error\|critical`, exact `action` name (e.g. `USER_LOGIN`), `days` 1–365, `limit` 1–500 (default 200). Returns `{ logs, total }` where `total` counts the full match before the limit |
| GET | `/api/health` | Liveness probe — unauthenticated, no DB touch, always `{ "status": "ok" }` |
| WS | `/api/ws-logs` | Real-time audit log stream — local Bun dev server only (`api/_server.ts`); requires a valid session cookie and a CORS-allowed origin, and only pushes that user's entries |

## Neon Auth proxy

`/neon-auth/auth/*` is rewritten to the Neon Auth backend
(`/neondb/auth/*`) for password reset and account flows. These requests are
proxied by Vercel and are not part of the `/api/*` route registry.
