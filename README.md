# AI Personal Finance Tracker

A premium, AI-powered personal finance management platform designed for clarity and growth. Track expenses, manage portfolios, and achieve financial goals with sophisticated design, intelligent insights, and an intuitive user experience.

> **New to the app?** Check out [HowToUse.md](./HowToUse.md) for a comprehensive user guide.

## Features

### AI-Powered Intelligence
- AI Financial Coach: Real-time personalized insights powered by Google Gemini 1.5 Flash, providing spending alerts and actionable coaching tips.
- Persisted Intelligence: AI-generated financial insights are now stored in the database, providing a consistent coaching history across sessions.
- Interactive AI Chat: Natural language conversations about your finances with context-aware responses and smart recommendations.
- Anomaly Detection: Automatic identification of unusual spending patterns and financial outliers.

### Dashboard Excellence
- Side-by-Side Analytics: Balanced layout featuring a redesigned Financial Health Score and Spending Flow (Budget Overview) in a unified view.
- Interactive Monitoring: Instant updates to savings rate, budget adherence, and emergency fund progress with real-time feedback.
- Actionable Intelligence: AI-generated next steps for improving financial health, integrated with full currency support.

### Advanced Analytics
- Intelligence Dashboard: Comprehensive financial overview with interactive Shadcn UI charts including:
  - Income vs Expenses area chart with 6-month trends.
  - Interactive spending breakdown pie chart with category-specific insights.
  - Month-over-month comparison metrics.
  - Dynamic stat cards with percentage changes.
- Enhanced Spending Flow: Visual spending breakdown featuring interactive legends, hover-triggered details, and category progress tracking.
- Health Score Visualization: Advanced animated gauge with score-specific gradients and detailed breakdown tooltips.
- Activity Calendar: High-fidelity visualization of daily financial events to identify spending patterns.
- Budget Analytics: Visual progress tracking with threshold alerts and spending forecasts.

### Core Financial Management
- Transaction Engine: Precision recording of income, expenses, and internal transfers with CSV export and recurring logic support.
- Budgeting System: Define and monitor spending limits per category with visual progress analytics.
- Wealth Goals: Set sophisticated savings targets with deadline-based tracking and contribution history.
- Unified Account View: Seamless management of diverse asset types including Checking, Savings, Credit, Investments, and Cash.
- Adaptive Categories: Flexible, hierarchical category system with customizable visual identifiers.

### Premium User Experience
- Eye Protection Light Mode: Specialized warm-ivory theme designed to reduce blue light strain and provide a comfortable reading experience.
- Dark Mode Excellence: Sophisticated dark theme with OKLCH color model and refined UI elements.
- Responsive Design: Fully mobile-responsive interface optimized for all screen sizes.
- PWA Ready: Progressive Web App capabilities for native-like performance and offline access.
- Global Preferences: Multi-currency support (USD, INR, EUR, GBP, JPY), regional date formats, and customizable settings.

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Frontend | React 18, TypeScript, Vite 7 |
| Styling | Tailwind CSS 4, Shadcn UI (Radix UI) |
| State Management | React Context API |
| Database | Neon (PostgreSQL) with Serverless Adapter |
| AI Integration | Google Gemini 1.5 Flash, React Markdown |
| Charts | Shadcn UI Charts (Recharts) |
| Icons | Hugeicons React, Lucide React |
| Runtime | Bun 1.3.x |
| Deployment | Vercel, Docker & Nginx |

## Key Highlights

### Financial Health Score
- Three-Pillar Scoring: Savings rate (40%), budget adherence (30%), and emergency fund progress (30%).
- Animated Visualization: Interactive ring progress with dynamic gradients reflecting financial standing.
- Detailed Breakdown: Comprehensive modal displaying individual pillar performance and month-over-month trends.
- Action Plan: prioritized, actionable steps to improve financial standing, localized to user currency.

### Recent Improvements
- Enhanced Financial Health Score: Redesigned with animated ring progress, interactive metric cards, score history trends, and a detailed breakdown visualization with tooltips.
- Advanced Spending Flow: Implemented interactive legends, category-specific details on hover, animated entry sequences, and budget progress indicators.
- Database-Stored AI Insights: Financial coaching insights are now persisted in the Neon database, ensuring persistence and improved context for growth tips.
- Side-by-Side Dashboard: Refined layout placing Health Score and Spending Flow side-by-side for a more efficient and balanced financial overview.
- Global Preference Integration: Deep integration of currency and regional settings across all analytics and AI insights.
- Refined Branding & UX: Polished typography, emerald-themed visual identity, and removal of gamification elements (badges) to focus on core data.
- Clean Documentation: Updated project documentation with professional formatting.
- Bun Runtime Optimization: Fully optimized for Bun, delivering sub-second hot-reloads and efficient build processes.

## Prerequisites

- Bun 1.3.x or later
- A Neon account

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sunil-gumatimath/Personal-Finance-Tracker.git
   cd Personal-Finance-Tracker
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

3. **Environment Setup:**

   Create a `.env` file in the root directory:
   ```env
   VITE_NEON_DATABASE_URL=your_neon_database_url
   VITE_USE_NEON=true
   ```

4. **Database Setup:**
    - Create a new project in [Neon](https://neon.tech)
    - Execute the SQL statements in `database/database-neon.sql` in your Neon SQL Editor
    - After your first login, run `SELECT seed_my_data();` to populate demo data

5. **AI Integration (Optional):**
   - Visit [Google AI Studio](https://aistudio.google.com)
   - Create an API Key
   - Add it in **Settings > AI Integration** within the app

6. **Start Development:**
   ```bash
   bun run dev
   ```

## Development Commands

**Start development server:**
```bash
bun run dev
```

**Type checking:**
```bash
bun run typecheck
```

**Linting:**
```bash
bun run lint
```

**Build for production:**
```bash
bun run build
```

## AI Features

The application includes powerful AI-driven insights powered by Google Gemini 1.5 Flash:

### AI Financial Coach
- Appears on the dashboard with real-time insights.
- Provides spending alerts and coaching tips.
- Automatically rotates through multiple insights.
- Click Chat to open the full AI Assistant.

### AI Assistant
- Natural language conversations about your finances.
- **Persistent Memory**: Chat history is preserved across sessions (per browser).
- **Data-Driven Insights**: Responses are generated based on your real-time transaction history and account balances.
- Ask questions like:
  - "How much did I spend on dining last month?"
  - "What are my top spending categories?"
  - "Give me tips to save more money."
  - "Am I on track with my budget?"

Note: AI features require a Gemini API key. Add it in **Settings > Preferences**.

## Deployment

### Vercel (Recommended)

The project is optimized for deployment on Vercel:

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Configure environment variables:
   - `VITE_NEON_DATABASE_URL`
   - `VITE_USE_NEON=true`
4. Deploy with Bun runtime for optimal performance

### Docker

Build and run with Docker Compose:

```bash
docker-compose up --build
```

Access the application at `http://localhost:8080`

## Project Structure

```
├── src/
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React Context providers
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities and helpers
│   ├── pages/          # Main application pages
│   └── types/          # TypeScript type definitions
├── database/           # Database schema and migrations
├── public/             # Static assets
└── scripts/            # Utility scripts
```

## Database Schema

The application uses Neon (PostgreSQL) with the following data model:

| Table | Description |
| ------- | ------------- |
| **profiles** | User profiles with currency preferences and personal information (stored in JSONB) |
| **accounts** | Financial accounts (checking, savings, credit, investment, cash) with balances |
| **categories** | Transaction categories for income and expenses with custom colors and icons |
| **transactions** | Financial transactions with support for recurring entries and categorization |
| **budgets** | Spending limits per category with weekly, monthly, or yearly periods |
| **goals** | Savings goals with target amounts, deadlines, and progress tracking |
| **ai_insights** | Persisted financial insights including anomalies, coaching tips, and kudos |
| **users** | Core authentication table for secure user management |

**Security:** All tables include Row Level Security (RLS) policies to ensure data privacy and user isolation.

## Support

For questions or issues, please open an issue on GitHub or check out the [HowToUse.md](./HowToUse.md) guide.

## License

This project is free and open-source software licensed under the MIT License.

