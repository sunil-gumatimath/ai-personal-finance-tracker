# AI Personal Finance Tracker

A premium, AI-powered personal finance management platform for tracking transactions, budgets, goals, accounts, debts, and financial health. The app combines a responsive React interface with Bun-powered API routes, Neon PostgreSQL storage, persisted AI insights, and configurable AI providers.

> **New to the app?** Start with [HowToUse.md](./HowToUse.md) for the user guide.

## Features

### AI-Powered Intelligence
- **AI Financial Coach**: Personalized coaching cards, spending alerts, kudos, and anomaly detection.
- **AI Assistant Chat**: Natural-language conversations about balances, budgets, goals, debt, categories, trends, and spending questions.
- **Provider Choice**: Configure either Google Gemini or OpenRouter in Settings.
- **Model Selection**: Choose Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash, Gemini 1.5 Pro, or Gemini 1.5 Flash; OpenRouter accepts custom model slugs such as `openrouter/free`.
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
- Debt and loan management with payment history, interest/principal breakdowns, payoff projections, and Snowball/Avalanche strategy comparisons.
- Multi-account tracking for checking, savings, credit, investments, and cash.
- Custom categories with colors and icons.
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
| Frontend | React 18, TypeScript 5.9, Vite 7 |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS 4, Radix UI / Shadcn-style components |
| State | React Context API and custom hooks |
| Database | Neon PostgreSQL with `@neondatabase/serverless` |
| Auth | Neon Auth client plus local session fallback for development resilience |
| AI | Google Gemini, OpenRouter, React Markdown |
| Charts | Recharts via Shadcn-style chart components |
| Icons | Lucide React, Hugeicons React |
| Deployment | Vercel functions, Docker, Nginx |

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
   - Run `database/database-neon.sql` in the Neon SQL editor.
   - Run `database/database-debts.sql` to add debt tracking tables and helpers.
   - After first login, optionally run `SELECT seed_my_data();` for demo data.

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
| `bun run typecheck` | Run TypeScript type checking |
| `bun run lint` | Run ESLint |
| `bun run build` | Typecheck and build for production |
| `bun run preview` | Preview the production Vite build |

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

1. Push the repository to GitHub.
2. Import it in [Vercel](https://vercel.com).
3. Configure environment variables:
   - `NEON_DATABASE_URL`
   - `AUTH_SECRET`
   - `NEON_AUTH_URL` if needed by your Neon Auth project
   - Optional provider-level AI keys only if you later add global server-side key support. The current UI is designed around per-user keys in Settings.
4. Deploy.

Notes:
- API files under `api/` are Vercel-compatible route handlers.
- `api/_server.ts` is the local Bun API shim and is not the primary production entrypoint.

### Docker

Build and run with Docker Compose:

```bash
docker-compose up --build
```

Then open `http://localhost:8080`.

## Project Structure

```text
├── src/
│   ├── components/       # Dashboard, layout, shared UI, theme, and error-boundary components
│   ├── contexts/         # Auth and preferences providers
│   ├── hooks/            # Financial health, insights, notifications, preferences, and responsive helpers
│   ├── lib/              # API client, auth, crypto, AI query utilities, Gemini helpers, and shared utilities
│   ├── pages/            # Dashboard, Transactions, Budgets, Goals, Debts, Accounts, Categories, Calendar, Settings, auth pages
│   └── types/            # API, database, preferences, and shared TypeScript types
├── api/                  # Bun/Vercel API handlers and shared backend utilities
│   ├── ai/               # AI chat and AI insights endpoints
│   ├── _ai-provider.ts   # Gemini/OpenRouter provider routing
│   ├── _db.ts            # Neon/mock database adapter
│   ├── _server.ts        # Local Bun API server
│   └── *.ts              # Accounts, auth, budgets, categories, debts, goals, notifications, profile, transactions
├── database/             # Neon schema, seed helpers, and debt tables
├── public/               # Static assets and PWA icons
└── scripts/              # Local dev and utility scripts
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
| `users` | Authentication user records |

All user-owned tables are designed around user isolation through Row Level Security policies and user-scoped API queries.

## Support

For questions or issues, open a GitHub issue or use [HowToUse.md](./HowToUse.md) for feature guidance.

## License

This project is free and open-source software licensed under the MIT License.
