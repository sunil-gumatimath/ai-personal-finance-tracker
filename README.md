# FinanceTrack

A premium, modern personal finance tracker built with React 19, TypeScript, and Supabase.

![FinanceTrack App](https://raw.githubusercontent.com/sunil-gumatimath/Personal-Finance-Tracker/main/public/preview.png)

## 🚀 Features

- **📊 Interactive Dashboard**: Real-time overview with dynamic charts and statistical summaries.
- **💼 Smart Accounts Management**: 
  - Manage checking, savings, investment, and credit accounts.
  - **New!** Premium separate views for active/inactive accounts.
  - Visual net worth calculation with assets vs liabilities breakdown.
- **💳 Advanced Transactions**: 
  - Track income, expenses, and transfers.
  - Recurring transaction support.
  - **CSV Export** functionality for data portability.
- **📅 Financial Calendar**: Visual monthly view of income and expenses.
- **🎯 Goals & Budgets**: Set spending limits and track savings milestones.
- **🔐 Secure Authentication**: Powered by Supabase Auth with robust protection.
- **🎨 Modern UI/UX**: 
  - Fully responsive design.
  - Glassmorphism effects and smooth animations.
  - **Dark Mode** support (System/Light/Dark).
- **🐳 Docker Ready**: Production-ready containerization support.
- **📱 PWA Enabled**: Installable on mobile and desktop devices.

## 🛠️ Tech Stack

- **Core**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, Shadcn UI, Lucide Icons
- **Backend & Auth**: Supabase
- **Visualization**: Recharts
- **Runtime**: Bun
- **Deployment**: Docker, Nginx

## 🏁 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Docker](https://www.docker.com/) (Optional, for containerization)
- A [Supabase](https://supabase.com) project

### 💻 Local Development

1. **Clone & Install**
   ```bash
   git clone https://github.com/yourusername/finance-track.git
   cd finance-track
   bun install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Database Setup**
   - Navigate to your Supabase project's SQL Editor.
   - Run the full schema script provided in `supabase/database.sql`.
   - This script creates all tables, triggers, policies, and seeds initial demo data.

4. **Run Dev Server**
   ```bash
   bun run dev
   ```
   Access the app at `http://localhost:5173`.

### 🐳 Docker Deployment

Run the application in a production-ready container using Docker Compose.

1. **Build and Run**
   ```bash
   docker-compose up --build -d
   ```

2. **Access Application**
   Open `http://localhost:8080` in your browser.

3. **Stop Container**
   ```bash
   docker-compose down
   ```

## 📂 Project Structure

```
src/
├── components/     # Reusable UI components (buttons, cards, etc.)
├── contexts/       # React Contexts (Auth, Theme)
├── hooks/          # Custom hooks (usePreferences, useAuth)
├── lib/            # Utilities (Supabase client, helpers)
├── pages/          # Main application pages (Dashboard, Accounts, etc.)
├── types/          # TypeScript definitions
└── App.tsx         # Main router and layout configuration
```

## 📜 License

MIT
