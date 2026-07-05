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
| Auth | Neon Auth client plus local session fallback for development resilience |
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

   # Optional, if your Neon Auth origin differs from the configured fallback
   NEON_AUTH_URL=your_neon_auth_url
   VITE_NEON_AUTH_URL=your_neon_auth_url

   # Local development without Neon
   USE_MOCK_DB=true
   ```

4. **Database setup for Neon:**

   - Create a Neon project.
   - Apply the versioned migrations in `database/migrations/` (`001_initial_schema.sql`, `002_debts_and_payments.sql`, `003_system_logs.sql`) in order in the Neon SQL editor.
   - Optionally run `database/seeds/default-categories.sql` to seed default categories.
   - The migrations under `database/migrations/` are the canonical source of truth.
   - Database tables are created empty; start adding your accounts and transactions in the UI.

5. **AI setup:**

   - Gemini: create a key in [Google AI Studio](https://aistudio.google.com).
   - OpenRouter: create a key in [OpenRouter](https://openrouter.ai/keys).
   - Add the key inside **Settings > Preferences > AI Integration**. Keys are saved in your profile preferences rather than hardcoded in the source.

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
   - `NEON_AUTH_URL` if needed by your Neon Auth project
   - Optional provider-level AI keys only if you later add global server-side key support. The current UI is designed around per-user keys in Settings.
4. Deploy.

Notes:
- `vercel.json` is configured to use `bun install` and `bun run build`, matching the local toolchain and `bun.lock`. API requests under `/api/*` are routed to a single Vercel serverless function at `api/handler.ts`.
- `api/handler.ts` and the local `api/_server.ts` share the same route registry, security headers, CORS allowlist, and rate-limit logic via `api/_lib/server/`, so runtime behavior stays consistent between local development and production.
- A lightweight `GET /api/health` liveness probe is available for uptime monitoring and deploy checks.

## Project Structure

```text
├── src/
│   ├── components/
│   │   ├── accounts/          # Account management: cards, modals, delete confirmation
│   │   ├── dashboard/         # Dashboard widgets: stats, charts, AI coach, health score
│   │   ├── debts/             # Debt tracking: cards, modals, payoff ring, strategy planner
│   │   ├── layout/            # App shell: sidebar, header, main layout wrapper
│   │   ├── system/            # App-level components: ErrorBoundary, Logo, theme provider/toggle
│   │   └── ui/                # Pure shadcn primitives (button, card, dialog, table, etc.)
│   ├── contexts/              # React contexts: authentication and global user preferences
│   ├── hooks/                 # Custom hooks: financial health, insights, accounts, debts, sidebar
│   ├── lib/                   # Frontend utilities
│   │   ├── api.ts             # Typed API client (throws ApiError on HTTP failures)
│   │   ├── auth.ts            # Neon Auth client setup
│   │   ├── config.ts          # Centralized import.meta.env access and env helpers
│   │   ├── errors.ts          # ApiError class with isAuthError/isRateLimited/isRetryable
│   │   ├── validate.ts        # Zod schemas for API payloads (login, account, transaction, etc.)
│   │   ├── log-formatter.ts   # System log display formatting
│   │   └── utils.ts           # cn() and shared helpers
│   ├── pages/                 # Route pages: dashboard, transactions, budgets, goals, debts, etc.
│   ├── types/                 # TypeScript type definitions: API, database, preferences
│   ├── App.tsx                # Root React component with routing
│   ├── index.css              # Global styles and Tailwind directives
│   └── main.tsx               # Frontend entrypoint
├── api/                       # Bun & Vercel API backend
│   ├── _lib/
│   │   ├── handlers/          # Route handlers: auth, accounts, transactions, budgets, goals, debts, health
│   │   │   └── ai/            # AI handlers: chat, insights, query processor
│   │   ├── middleware/        # Sliding-window rate limiter
│   │   ├── server/            # Shared server layer: config (CORS/security headers), route registry
│   │   ├── services/          # DB adapters, AI providers (Gemini, OpenRouter), logger, auth, sessions
│   │   └── utils/             # Crypto helpers, default categories, DNS bypass, shared types
│   ├── handler.ts             # Vercel serverless function entrypoint
│   ├── _server.ts             # Local development Bun HTTP server shim
│   └── tsconfig.json          # API-specific TypeScript configuration
├── database/                  # Neon PostgreSQL schema and data
│   ├── migrations/            # Versioned migrations (canonical source of truth)
│   └── seeds/                 # Seed data (default categories)
├── .github/workflows/ci.yml   # CI: lint + typecheck (frontend + API) + build on push/PR
├── public/                    # Static assets: favicon, PWA icons
└── scripts/                   # Dev helpers: fullstack runner
```

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
| `users` | Authentication user records |

All user-owned tables are designed around user isolation through Row Level Security policies and user-scoped API queries.

## Support

For questions or issues, open a GitHub issue or use [HowToUse.md](./HowToUse.md) for feature guidance.

## License

This project is free and open-source software licensed under the MIT License.
