# AI Personal Finance Tracker

A premium, AI-powered personal finance management platform for tracking transactions, budgets, goals, accounts, debts, and financial health. The app combines a responsive React interface with Bun-powered API routes, Neon PostgreSQL storage, persisted AI insights, and configurable AI providers.



## Features

### AI-Powered Intelligence

- **AI Financial Coach**: Personalized coaching cards, spending alerts, kudos, and anomaly detection with currency-aware thresholds.
- **AI Assistant Chat**: Natural-language conversations about balances, budgets, goals, debt, categories, trends, and spending questions.
- **KiloCode AI**: Configure the Kilo Gateway API key in Settings.
- **Free Model Selection**: Choose from a curated allowlist of free KiloCode models (with context sizes and descriptions), default `inclusionai/ling-3.0-flash:free`.
- **Persisted Insights**: AI insights are stored in the database, can be dismissed per-card, and are reused to avoid unnecessary regeneration.
- **Chat Cooldown**: UI-level cooldown between AI requests to prevent spam.
- **Privacy Notice**: Settings explicitly warns that financial data is sent to the KiloCode API.
- **Demo AI Mode**: Use `demo-key` to see sample AI responses without configuring a real API key.

### Dashboard & Analytics

- Financial health score with savings-rate, budget-adherence, and emergency-fund pillars.
- Side-by-side health and spending-flow overview for fast decision making.
- Income vs. expenses chart, spending breakdowns, recent transactions, and budget progress.
- Activity calendar for daily income and expense patterns.
- Currency-aware analytics across the app.

### Core Financial Management

- Transaction engine for income, expenses, and internal transfers.
- **Sortable, paginated transaction history**: sort by date, amount, description, or category, page through results with an adjustable page size, and share filtered views — search and type filters persist in the URL.
- **Recurring transaction automation**: recurring templates with frequency, optional end date, and a server-computed next-due date. A Vercel Cron job (or the in-app **Process Recurring** button) materializes occurrences automatically — each one appears as a normal transaction linked to its template.
- **Natural-language quick entry**: type *"paid $45 for groceries yesterday"* on the Transactions page and the AI extracts the fields into the add-transaction form for review.
- **Reports page with PDF/CSV export**: month or trailing-12-month summaries — income vs. expenses, savings rate, category breakdowns, account balances, and transactions — downloadable as a formatted PDF or CSV.
- **Weekly AI digest**: a generated summary of the week (spending, budgets, goals, debts) on the dedicated **Digest** page, with week/month/year/custom periods, one-click (re)generation, an archive of past digests, and an "Ask AI" drill-in.
- Recurring transaction metadata and CSV export.
- Category-based budgets with visual threshold states.
- Savings goals with contribution tracking.
- Debt and loan management with payment history, interest/principal breakdowns, payoff projections, and an **Interactive Payoff Planner** that uses a slider to simulate extra monthly payments, charts payoff balance projections over time, and compares Snowball vs. Avalanche strategy outcomes (time and interest saved).
- Multi-account tracking for checking, savings, credit, investments, and cash.
- Custom categories with custom color palettes, interactive icon selectors, real-time live preview, and quick category metrics cards.
- Password reset flow and account deletion.

### Premium User Experience

- Responsive design for desktop and mobile.
- Light, dark, and system themes with seven accent colors (Default, Emerald, Navy, Violet, Cyan, Rose, Sunset).
- Progressive Web App support through Vite PWA.
- Multi-currency support: USD, INR, EUR, GBP, and JPY.
- Regional date-format preferences.
- Security-focused API defaults, including auth rate limiting, security headers, strict CORS handling, and sanitized error responses.
- System logs page with real-time WebSocket streaming, severity/action/date-range filtering, search, and a per-entry detail drawer for monitoring audit events.

## Tech Stack

| Category | Technologies |
| --- | --- |
| Runtime / Package Manager | Bun 1.3.x |
| Frontend | React 18, TypeScript 5.9, Vite 6 |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS 4, Radix UI / Shadcn-style components |
| State | React Context API and custom hooks |
| Database | Neon PostgreSQL with `@neondatabase/serverless` |
| Auth | Neon Auth with HttpOnly session cookies |
| AI | KiloCode AI Gateway, React Markdown |
| Charts | Recharts via Shadcn-style chart components |
| Icons | Lucide React |
| Deployment | Vercel functions |

## Prerequisites

- Bun 1.3.x or later
- A Neon project for persistent PostgreSQL storage, unless using mock database mode
- A Kilo Gateway API key for AI features
- Vercel CLI only if you want to test using `vercel dev`

## Quick Start

1. **Clone the repository:**

   ```bash
   git clone https://github.com/sunil-gumatimath/ai-personal-finance-tracker.git
   cd ai-personal-finance-tracker
   ```

2. **Install dependencies:**

   ```bash
   bun install
   ```

3. **Create `.env` in the project root:**

   ```env
   # Production / persistent database
   NEON_DATABASE_URL=your_neon_database_url
   AUTH_SECRET=your_long_random_secret
   API_KEY_ENCRYPTION_SECRET=your_long_random_api_key_encryption_secret

   # Optional, if your Neon Auth origin differs from the configured fallback
   NEON_AUTH_URL=your_neon_auth_url
   VITE_NEON_AUTH_URL=your_neon_auth_url

   # Optional local development flag: allow cookies over plain HTTP
   # locally (forces Secure=false). Never use in production.
   ALLOW_INSECURE_COOKIES=true

   # Local development without Neon
   USE_MOCK_DB=true
   ```

   See [`.env.example`](./.env.example) for every supported variable, including `ALLOWED_ORIGINS` (extra CORS/auth origins), `VITE_APP_URL` (public app URL for auth redirects/emails), `KILOCODE_FREE_MODELS`, `PORT`, and `CRON_SECRET`.

4. **Database setup for Neon:**

   - Create a Neon project.
   - Apply the versioned migrations in `database/migrations/` (`001_initial_schema.sql`, `002_debts_and_payments.sql`, `003_system_logs.sql`, `004_security_hardening.sql`, `005_recurring_and_digests.sql`, `006_data_integrity.sql`, `007_row_level_security_staged.sql`) in order in the Neon SQL editor.
   - Optionally run `database/seeds/default-categories.sql` to seed default categories.
   - The migrations under `database/migrations/` are the canonical source of truth.
   - Database tables are created empty; start adding your accounts and transactions in the UI.

5. **AI setup:**

   - KiloCode: get a Kilo Gateway API key from [app.kilo.ai](https://app.kilo.ai) (Your Profile → API key at the bottom of the page).
   - Add the key inside **Settings > Preferences > AI Integration**. Keys are encrypted and stored server-side; the browser only receives configured/not-configured flags.

6. **Start local fullstack development:**

   ```bash
   bun run dev
   ```

   This starts the Bun API server on port 3001 and the Vite frontend with `/api` proxying.

### Recurring automation cron (optional, for production)

`vercel.json` already declares a daily cron (`0 3 * * *`, i.e. **03:00 UTC**) that hits `/api/cron?action=recurring` to materialize due recurring transactions for all users. To enable it, add a `CRON_SECRET` env var in your Vercel project — Vercel sends it as `Authorization: Bearer <CRON_SECRET>` automatically, and the endpoint refuses to run without it. Without the cron, users can still use the **Process Recurring** button on the Transactions page, which runs the same logic for the signed-in user.

## Development Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start API and Vite together for local fullstack development |
| `bun run api` | Start only the Bun API server with watch mode |
| `bun run vite` | Start only the frontend dev server |
| `bun run typecheck` | Run TypeScript type checking for the frontend |
| `bun run typecheck:api` | Run TypeScript type checking for the API |
| `bun run lint` | Run ESLint across the whole project |
| `bun run test` | Run Bun unit tests |
| `bun run build` | Typecheck and build for production |
| `bun run preview` | Preview the production Vite build |
| `bun scripts/migrate.ts` | Apply all pending migrations from `database/migrations/` in filename order (skips versions already recorded in the `schema_migrations` ledger; reads `NEON_DATABASE_URL` from `.env`) |
| `bun scripts/migrate.ts <file.sql>` | Apply a single migration file (recorded in the ledger like any other run) |
| `bun scripts/migrate.ts <file.sql> --force` | Re-apply a file even if its version is already recorded (migrations are idempotent) |

## CI / Continuous Integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and pull request to `main`/`master`:

1. Gitleaks secret scan (full git history)
2. `bun install --frozen-lockfile`
3. `bun run lint`
4. `bun run typecheck` (frontend)
5. `bun run typecheck:api` (API)
6. `bun test --coverage`
7. `bun run build`

In-progress runs for the same branch are cancelled automatically so the latest commit is always what gets checked.

## API Reference

All endpoints, conventions, and error codes are documented in [docs/API.md](docs/API.md).

## AI Features

### AI Financial Coach

- Appears on the dashboard.
- Generates coaching, anomaly (currency-aware thresholds), and kudo insights.
- Stores active insights in `ai_insights` so they persist across sessions.
- Supports per-card dismissal and refresh behavior.

### AI Assistant

- Opens from the dashboard AI experience.
- Uses current financial context to answer questions about balances, spending, income, goals, budgets, debt, and net worth.
- Supports KiloCode AI Gateway preferences with a curated free-model dropdown.
- Shows structured finance-oriented responses with React Markdown rendering.
- 2-second cooldown between requests to prevent spam.

AI features require a valid provider key. Add it in **Settings > Preferences > AI Integration**.

## Deployment

### Vercel

1. Push the repository to GitHub (the included CI workflow runs lint, typecheck, and build on every push/PR to `main`).
2. Import it in [Vercel](https://vercel.com) and set the framework to **Vite**.
3. Configure environment variables:
   - `NEON_DATABASE_URL`
   - `AUTH_SECRET`
   - `API_KEY_ENCRYPTION_SECRET`
   - `NEON_AUTH_URL` if needed by your Neon Auth project
   - `CRON_SECRET` to authenticate the daily recurring-transactions cron
   - Optional provider-level AI keys only if you later add global server-side key support. The current UI is designed around per-user keys in Settings.
4. Deploy.

Notes:

- `vercel.json` is configured to use `bun install` and `bun run build`, matching the local toolchain and `bun.lock`. API requests under `/api/*` are routed to a single Vercel serverless function at `api/handler.ts`.
- Internal API modules live in underscore-prefixed directories (`api/_routes/`, `api/_services/`, …) that Vercel ignores when detecting serverless functions, so only `api/handler.ts` is deployed — keeping the deployment within the Hobby plan's 12-function limit.
- `api/handler.ts` and the local `api/_server.ts` share the same route registry, security headers, CORS allowlist, and rate-limit logic via `api/_config/` and `api/_routes/`, so runtime behavior stays consistent between local development and production.
- A lightweight `GET /api/health` liveness probe is available for uptime monitoring and deploy checks.

## Project Structure

```text
├── src/
│   ├── app/                   # Frontend entrypoint and root router (main.tsx, App.tsx)
│   ├── components/
│   │   ├── layout/            # App shell: sidebar, header, main layout wrapper
│   │   ├── system/            # App-level components: ErrorBoundary, Logo, theme provider/toggle
│   │   └── ui/                # Shadcn/Radix primitives (button, card, dialog, table, etc.)
│   ├── contexts/              # React contexts: authentication (HttpOnly cookie) and global preferences
│   ├── features/              # Feature modules with colocated components and public entrypoints
│   │   ├── accounts/          # Account management UI and logic
│   │   ├── budgets/           # Budget management UI and logic
│   │   ├── dashboard/         # Cards, charts, AI coach/chat, and financial health
│   │   ├── debts/             # Debt cards, payment modals, and payoff planner
│   │   ├── system-logs/       # Log timeline, detail drawer, and visual helpers
│   │   └── transactions/      # Transaction table and add/edit dialog
│   ├── hooks/                 # Custom hooks: financial health, insights, debts, preferences, sidebar, system logs
│   ├── lib/                   # Frontend utilities
│   │   ├── ai-models.ts       # AI model allowlist resolution
│   │   ├── api-client.ts      # Typed API client (throws ApiError on HTTP failures)
│   │   ├── auth.ts            # Neon Auth client setup
│   │   ├── debt-calculations.ts # Payoff projections and snowball/avalanche comparisons
│   │   ├── errors.ts          # ApiError class with isAuthError/isRateLimited/isRetryable
│   │   ├── initials.ts        # Avatar-fallback initials from name/email
│   │   ├── log-export.ts      # System log CSV export
│   │   ├── log-formatter.ts   # System log display formatting
│   │   ├── number.ts          # Defensive numeric coercion for money fields
│   │   ├── palette.ts         # Shared selectable color swatches (categories/accounts/debts)
│   │   ├── preferences-storage.ts # Preference persistence helpers
│   │   ├── transaction-csv.ts # Transaction CSV export
│   │   └── utils.ts           # cn() and shared helpers
│   ├── pages/                 # Route pages: dashboard, transactions, budgets, goals, debts, reports, etc.
│   ├── types/                 # TypeScript type definitions: API, database, preferences
│   └── index.css              # Global styles and Tailwind directives
├── api/                       # Bun & Vercel API backend (single deployed function)
│   ├── _config/               # Runtime configuration, CORS allowlist, security headers
│   ├── _domain/               # Pure domain rules and finance validation
│   ├── _errors/               # AppError and API error helpers
│   ├── _middleware/           # Sliding-window + DB-backed rate limiter
│   ├── _repositories/         # Data access layer and query builder
│   ├── _routes/               # HTTP route modules and route registry (index.ts)
│   ├── _services/             # Business logic, ownership checks, auth, audit log, AI providers
│   ├── _utils/                # Crypto, response, money formatting, query-processor, DNS bypass, default categories, types
│   ├── handler.ts             # Vercel serverless function entrypoint (the only deployed function)
│   ├── _server.ts             # Local Bun HTTP server shim (also serves /api/ws-logs)
│   └── tsconfig.json          # API-specific TypeScript configuration
├── database/                  # Neon PostgreSQL schema and data
│   ├── migrations/            # Versioned migrations (canonical source of truth)
│   └── seeds/                 # Seed data (default categories)
├── docs/                      # Project documentation (API reference)
├── .github/workflows/ci.yml   # CI: gitleaks + lint + typecheck (frontend + API) + test (coverage) + build on push/PR to main
├── public/                    # Static assets: favicon, PWA icons
└── scripts/                   # Dev helpers: fullstack runner (dev.ts), migration runner (migrate.ts)
```

> **Layout note:** `api/_routes/*` are the controllers. Feature-specific frontend components live under
> `src/features/*`; `src/components/` is reserved for shared application chrome and UI primitives.

## Database Schema

The app uses Neon PostgreSQL with these primary tables:

| Table | Description |
| --- | --- |
| `profiles` | User profile with a `currency` column plus a `preferences` JSONB holding regional/date prefs and AI settings |
| `accounts` | Checking, savings, credit, investment, and cash accounts |
| `categories` | Income and expense categories with custom colors and icons |
| `transactions` | Income, expense, transfer, and recurring transaction records |
| `budgets` | Category spending limits for weekly, monthly, and yearly periods |
| `goals` | Savings goals, target dates, and progress |
| `debts` | Loans, cards, and other debts with interest and payoff metadata |
| `debt_payments` | Debt payment history with principal and interest breakdown |
| `ai_insights` | Persisted AI-generated anomalies, coaching tips, and kudos |
| `ai_digests` | Weekly AI-generated summaries (one per user per week) |
| `system_logs` | Audit log of user actions, errors, and deployment events with severity and metadata |
| `rate_limits` | Sliding-window rate-limit counters (DB-backed limiter) |
| `users` | Authentication user records |

User isolation is enforced primarily through user-scoped API queries and `ownership.service.ts`
reference checks, and this remains the only active enforcement layer at runtime. Migration
`007_row_level_security_staged.sql` stages PostgreSQL Row Level Security for activation: it
idempotently defines `tenant_isolation_<table>` policies (`USING` + `WITH CHECK` comparing each
row's `user_id` to an `app.current_user_id` session variable) on all eleven tenant tables
(`profiles`, `accounts`, `categories`, `transactions`, `budgets`, `goals`, `ai_insights`, `debts`,
`debt_payments`, `ai_digests`, `system_logs`). The policies are deliberately **inert** — the
`ENABLE ROW LEVEL SECURITY` / `FORCE ROW LEVEL SECURITY` statements are left commented out because
the current data layer uses the Neon HTTP driver (`neon()`), where each query is an isolated
auto-commit request with no way to set a per-request session variable. Enabling RLS now would make
every policy evaluate against an unset variable and match zero rows (fail-closed). Activation is
deferred until the data layer switches to the WebSocket pool driver and wraps requests in
`BEGIN; SET LOCAL app.current_user_id = ...; COMMIT;`. Until then, tenant isolation depends entirely
on the API layer.

## Support

For questions or issues, open a GitHub issue and refer to the feature descriptions above.

## License

This project is free and open-source software licensed under the MIT License.
