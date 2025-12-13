# FinanceTrack - Personal Finance Tracker

A modern personal finance tracking application built with React, TypeScript, Vite, Shadcn UI, and Supabase.

![Login Page](./screenshots/login.png)

## Features

- 📊 **Dashboard** - Financial overview with stats, charts, and recent transactions
- 💳 **Transactions** - Track income and expenses with full CRUD operations
- 🎯 **Budgets** - Set spending limits by category with progress tracking
- 🏷️ **Categories** - Organize transactions with custom categories and colors
- 🏦 **Accounts** - Manage multiple bank accounts, cards, and wallets
- 🔐 **Authentication** - Secure login/signup with Supabase Auth
- 🌙 **Dark Mode** - Beautiful dark theme by default with light mode toggle

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 7 with Bun
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) + Tailwind CSS v4
- **Charts**: Recharts
- **Icons**: Lucide React
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL + Auth)
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) or Node.js 18+
- A [Supabase](https://supabase.com/) account

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd personal-finance-tracker
```

2. Install dependencies:
```bash
bun install
```

3. Create a Supabase project at [supabase.com](https://supabase.com/)

4. Run the database schema:
   - Go to your Supabase project's SQL Editor
   - Copy and run the contents of `supabase/schema.sql`

5. Create environment file:
```bash
cp .env.example .env
```

6. Update `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

7. Start the development server:
```bash
bun run dev
```

8. Open [http://localhost:5173](http://localhost:5173) in your browser

## Project Structure

```
src/
├── components/
│   ├── ui/              # Shadcn UI components
│   ├── layout/          # Layout components (Sidebar, Header)
│   └── dashboard/       # Dashboard-specific components
├── contexts/
│   └── AuthContext.tsx  # Authentication context
├── hooks/
│   └── use-mobile.ts    # Responsive hook
├── lib/
│   ├── supabase.ts      # Supabase client
│   └── utils.ts         # Utility functions
├── pages/
│   ├── Dashboard.tsx
│   ├── Transactions.tsx
│   ├── Budgets.tsx
│   ├── Categories.tsx
│   ├── Accounts.tsx
│   ├── Settings.tsx
│   ├── Login.tsx
│   └── Signup.tsx
├── types/
│   └── database.ts      # TypeScript types
├── App.tsx              # Main app with routing
└── main.tsx             # Entry point
```

## Database Schema

The application uses the following Supabase tables:

- **profiles** - User profile information
- **accounts** - Bank accounts, wallets, credit cards
- **categories** - Transaction categories (income/expense)
- **transactions** - All financial transactions
- **budgets** - Monthly/category budgets

All tables have Row Level Security (RLS) enabled to ensure users can only access their own data.

## Scripts

```bash
# Start development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Lint code
bun run lint
```

## License

MIT
