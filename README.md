# FinanceTrack

A modern personal finance tracker built with React, TypeScript, Vite, and Supabase.

## Features

- 📊 **Dashboard** - Overview with stats and charts
- 💳 **Transactions** - Track income and expenses
- 🎯 **Budgets** - Set limits and track progress
- 🏷️ **Categories** - Custom organization
- 🔐 **Authentication** - Secure Supabase Auth

## Getting Started

1. **Install Dependencies**
   ```bash
   bun install
   ```

2. **Setup Backend**
   - Create a project at [Supabase](https://supabase.com)
   - Run the contents of `supabase/schema.sql` in the SQL Editor

3. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

4. **Run Development Server**
   ```bash
   bun run dev
   ```

## License

MIT
