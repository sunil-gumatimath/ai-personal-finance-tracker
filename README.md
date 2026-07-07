# AI Personal Finance Tracker

A premium, AI-powered personal finance management platform for tracking transactions, budgets, goals, accounts, debts, and financial health. The app combines a responsive React interface with Bun-powered API routes, Neon PostgreSQL storage, persisted AI insights, and configurable AI providers.

> **New to the app?** Start with [HowToUse.md](./HowToUse.md) for the user guide.

## Features

### AI-Powered Intelligence
- **AI Financial Coach**: Personalized coaching cards, spending alerts, kudos, and anomaly detection.
- **AI Assistant Chat**: Natural-language conversations about balances, budgets, goals, debt, categories, trends, and spending questions.
- **Provider Choice**: Configure either Google Gemini or OpenRouter in Settings.
- **Model Selection**: Choose Gemini 3.5 Flash, Gemini 3.1 Pro, Gemini 3.1 Flash-Lite, Gemini 3.0 Pro, or Gemini 3.0 Flash; OpenRouter accepts custom model slugs such as `openrouter/free`.
- **Persisted Insights**: AI insights are stored in the database, can be dismissed, and are reused to avoid unnecessary regeneration.

### Dashboard & Analytics
- Financial health score with savings-rate, budget-adherence, and emergency-fund pillars.
- Side-by-side health and spending-flow overview for fast decision making.
- Income vs. expenses chart, spending breakdowns, recent transactions, and budget progress.
- Activity calendar for daily income and expense patterns.
- Currency-aware analytics across the app.

### Core Financial Management
- Transaction engine for income, expenses, and internal transfers.
- Recurring transaction metadata and CSV export.
- Category-based budgets with visual threshold states.
- Savings goals with contribution tracking.
- Debt and loan management with payment history, interest/principal breakdowns, payoff projections, and an **Interactive Payoff Planner** that uses a slider to simulate extra monthly payments, charts payoff balance projections over time, and compares Snowball vs. Avalanche strategy outcomes (time and interest saved).
- Multi-account tracking for checking, savings, credit, investments, and cash.
- Custom categories with custom color palettes, interactive icon selectors, real-time live preview, and quick category metrics cards.
- Password reset flow.

### Premium User Experience
- Responsive design for desktop and mobile.
- Light, dark, and system themes.
- Progressive Web App support through Vite PWA.
- Multi-currency support: USD, INR, EUR, GBP, and JPY.
- Regional date-format preferences.
- Security-focused API defaults, including auth rate limiting, security headers, strict CORS handling, and sanitized error responses.

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
| AI | Google Gemini, OpenRouter, React Markdown |
| Charts | Recharts via Shadcn-style chart components |
| Icons | Lucide React |
| Deployment | Vercel functions |

## Prerequisites

- Bun 1.3.x or later
- A Neon project for persistent PostgreSQL storage, unless using mock database mode
- A Gemini API key or OpenRouter API key for AI features
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

   # Optional local development flags
   ALLOW_INSECURE_COOKIES=true

   # Local development without Neon
   USE_MOCK_DB=true
   ```

4. **Database setup for Neon:**

   - Create a Neon project.
   - Apply the versioned migrations in `database/migrations/` (`001_initial_schema.sql`, `002_debts_and_payments.sql`, `003_system_logs.sql`, `004_security_hardening.sql`) in order in the Neon SQL editor.
   - Optionally run `database/seeds/default-categories.sql` to seed default categories.
   - The migrations under `database/migrations/` are the canonical source of truth.
   - Database tables are created empty; start adding your accounts and transactions in the UI.

5. **AI setup:**

   - Gemini: create a key in [Google AI Studio](https://aistudio.google.com).
   - OpenRouter: create a key in [OpenRouter](https://openrouter.ai/keys).
   - Add the key inside **Settings > Preferences > AI Integration**. Keys are encrypted and stored server-side; the browser only receives configured/not-configured flags.

6. **Start local fullstack development:**

   ```bash
   bun run dev
   ```

   This starts the Bun API server on port 3001 and the Vite frontend with `/api` proxying.

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

## CI / Continuous Integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and pull request to `main`/`master`:

1. `bun install --frozen-lockfile`
2. `bun run lint`
3. `bun run typecheck` (frontend)
4. `bun run typecheck:api` (API)
5. `bun run build`

In-progress runs for the same branch are cancelled automatically so the latest commit is always what gets checked.

## AI Features

### AI Financial Coach
- Appears on the dashboard.
- Generates coaching, anomaly, and kudo insights.
- Stores active insights in `ai_insights` so they persist across sessions.
- Supports dismissal and refresh behavior.

### AI Assistant
- Opens from the dashboard AI experience.
- Uses current financial context to answer questions about balances, spending, income, goals, budgets, debt, and net worth.
- Supports Gemini and OpenRouter preferences.
- Shows structured finance-oriented responses with React Markdown rendering.

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
   - Optional provider-level AI keys only if you later add global server-side key support. The current UI is designed around per-user keys in Settings.
4. Deploy.

Notes:
- `vercel.json` is configured to use `bun install` and `bun run build`, matching the local toolchain and `bun.lock`. API requests under `/api/*` are routed to a single Vercel serverless function at `api/handler.ts`.
- `api/handler.ts` and the local `api/server.ts` share the same route registry, security headers, CORS allowlist, and rate-limit logic via `api/config/` and `api/routes/`, so runtime behavior stays consistent between local development and production.
- A lightweight `GET /api/health` liveness probe is available for uptime monitoring and deploy checks.

## Project Structure

```text
├── src/
│   ├── app/                   # Frontend entrypoint and root router (main.tsx, App.tsx)
│   ├── components/
│   │   ├── accounts/          # Compatibility barrels re-exporting src/features/accounts/components
│   │   ├── dashboard/         # Compatibility barrels re-exporting src/features/dashboard/components
│   │   ├── debts/             # Compatibility barrels re-exporting src/features/debts/components
│   │   ├── layout/            # App shell: sidebar, header, main layout wrapper
│   │   ├── system/            # App-level components: ErrorBoundary, Logo, theme provider/toggle
│   │   └── ui/                # Shadcn/Radix primitives (button, card, dialog, table, etc.)
│   ├── contexts/              # React contexts: authentication (HttpOnly cookie) and global preferences
│   ├── features/              # Feature modules with colocated components
│   │   ├── accounts/components/   # AccountCard, AccountModal, DeleteConfirmation
│   │   ├── dashboard/components/  # StatCard, charts, AI coach/chat, health score
│   │   └── debts/components/      # DebtCard, modals, payoff ring, strategy planner
│   ├── hooks/                 # Custom hooks: financial health, insights, accounts, debts, sidebar
│   ├── lib/                   # Frontend utilities
│   │   ├── api-client.ts      # Typed API client (throws ApiError on HTTP failures)
│   │   ├── auth.ts            # Neon Auth client setup
│   │   ├── config.ts          # Centralized import.meta.env access and env helpers
│   │   ├── errors.ts          # ApiError class with isAuthError/isRateLimited/isRetryable
│   │   ├── preferences-storage.ts # Preference persistence helpers
│   │   ├── validate.ts        # Validation helpers for API payloads
│   │   ├── log-formatter.ts   # System log display formatting
│   │   └── utils.ts           # cn() and shared helpers
│   ├── pages/                 # Route pages: dashboard, transactions, budgets, goals, debts, etc.
│   ├── tests/                 # Frontend test helpers
│   ├── types/                 # TypeScript type definitions: API, database, preferences
│   └── index.css              # Global styles and Tailwind directives
├── api/                       # Bun & Vercel API backend (flat layout; no _lib/ prefix)
│   ├── config/                # Runtime configuration, CORS allowlist, security headers
│   ├── domain/                # Pure domain rules and finance validation
│   ├── errors/                # AppError and API error helpers
│   ├── middleware/            # Sliding-window + DB-backed rate limiter
│   ├── repositories/          # Data access layer and query builder
│   ├── routes/                # HTTP route modules and route registry (index.ts)
│   ├── services/              # Business logic, ownership checks, auth, audit log, AI providers
│   ├── tests/                 # API test support
│   ├── utils/                 # Crypto, response, query-processor, DNS bypass, default categories, types
│   ├── handler.ts             # Vercel serverless function entrypoint
│   ├── server.ts              # Local Bun HTTP server shim (also serves /api/ws-logs)
│   └── tsconfig.json          # API-specific TypeScript configuration
├── database/                  # Neon PostgreSQL schema and data
│   ├── migrations/            # Versioned migrations (canonical source of truth)
│   ├── scripts/               # Database helper scripts
│   └── seeds/                 # Seed data (default categories)
├── docs/                      # Additional project documentation
├── .github/workflows/ci.yml   # CI: lint + typecheck (frontend + API) + test + build on push/PR
├── public/                    # Static assets: favicon, PWA icons
└── scripts/                   # Dev helpers: fullstack runner (dev.ts)
```

> **Layout note:** `api/routes/*` are the controllers; there is no separate `api/controllers/`
> or `api/schemas/` layer (those directories were removed as empty scaffolding). `src/components/{accounts,dashboard,debts}`
> are thin re-export barrels — the real implementations live in `src/features/*/components`.

## Database Schema

The app uses Neon PostgreSQL with these primary tables:

| Table | Description |
| --- | --- |
| `profiles` | User profile, currency, regional preferences, and AI settings stored in JSONB |
| `accounts` | Checking, savings, credit, investment, and cash accounts |
| `categories` | Income and expense categories with custom colors and icons |
| `transactions` | Income, expense, transfer, and recurring transaction records |
| `budgets` | Category spending limits for weekly, monthly, and yearly periods |
| `goals` | Savings goals, target dates, and progress |
| `debts` | Loans, cards, and other debts with interest and payoff metadata |
| `debt_payments` | Debt payment history with principal and interest breakdown |
| `ai_insights` | Persisted AI-generated anomalies, coaching tips, and kudos |
| `system_logs` | Audit log of user actions, errors, and deployment events with severity and metadata |
| `rate_limits` | Sliding-window rate-limit counters (DB-backed limiter) |
| `users` | Authentication user records |

User isolation is enforced primarily through user-scoped API queries and `ownership.service.ts`
reference checks (see `security_best_practices_report.md`, SEC-002 / SEC-010). No PostgreSQL Row
Level Security policies are defined yet; tenant isolation depends entirely on the API layer.

## Support

For questions or issues, open a GitHub issue or use [HowToUse.md](./HowToUse.md) for feature guidance.

## License

This project is free and open-source software licensed under the MIT License.
