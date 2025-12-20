# Finance Tracker

A premium, AI-powered personal finance management platform designed for clarity and growth. Track expenses, manage portfolios, and achieve financial goals with sophisticated design, intelligent insights, and an intuitive user experience.

## Features

### AI-Powered Intelligence
- AI Financial Coach: Real-time personalized insights powered by Google Gemini 3 Flash, providing spending alerts, kudos for achievements, and actionable coaching tips.
- Interactive AI Chat: Natural language conversations about your finances with context-aware responses and smart recommendations.
- Anomaly Detection: Automatic identification of unusual spending patterns and financial outliers.

### Advanced Analytics
- Intelligence Dashboard: Comprehensive financial overview with interactive Shadcn UI charts including:
  - Income vs Expenses area chart with 6-month trends.
  - Spending breakdown pie chart with category insights.
  - Month-over-month comparison metrics.
  - Dynamic stat cards with percentage changes.
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
- Dark Mode Excellence: Sophisticated dark theme with OKLCH color model and glassmorphism effects.
- Responsive Design: Fully mobile-responsive interface optimized for all screen sizes.
- PWA Ready: Progressive Web App capabilities for native-like performance and offline access.
- Global Preferences: Multi-currency support (USD, INR, EUR, GBP, JPY), regional date formats, and customizable settings.

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Frontend | React 18, TypeScript, Vite 7 |
| Styling | Tailwind CSS 4, Shadcn UI (Radix UI) |
| State Management | React Context API |
| Routing | React Router DOM 7 |
| Charts | Shadcn UI Charts (Recharts) |
| AI Integration | Google Gemini 3 Flash, React Markdown |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| Icons | Lucide React |
| Runtime | Bun |
| PWA | Vite PWA Plugin |
| Aesthetics | OKLCH Color Model, Glassmorphism, Custom Filters |

## Key Highlights

### Recent Improvements
- Enhanced Dashboard Charts: Migrated to Shadcn UI components with smooth animations, interactive tooltips, and premium styling.
- Refined Settings UI: Horizontal tabs layout with consistent rounded corners and cohesive design language.
- Mobile Responsive: Fully optimized for all screen sizes with adaptive layouts.
- AI Integration: Powered by Gemini 3 Flash for intelligent financial insights.
- Improved Logo Design: Modern finance-themed logo with emerald/teal gradient and abstract growth arrow.
- Advanced Visualizations: Area charts for income/expenses trends and pie charts for spending breakdown.
- Bun Optimization: Fully transitioned to Bun for faster development and consistent environment.

## Prerequisites

- Bun (Latest version)
- A Supabase account

## Installation

1. Clone the repository:
    ```bash
    git clone <repository-url>
    cd antigravity-finance
    ```

2. Install dependencies:
    ```bash
    bun install
    ```

3. Environment Setup:
    Create a .env file in the root directory:
    ```bash
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4. Adding Your Gemini API Key:
    - Visit Google AI Studio.
    - Sign in with your Google account.
    - Create an API Key and copy it.
    - Add it in Settings > Preferences > AI Integration within the application.

5. Database Initialization:
    - Execute supabase/database.sql in your Supabase SQL Editor.
    - Run `SELECT seed_my_data();` after your first login to populate the dashboard with demonstration data.

## Development

```bash
bun run dev
```

## AI Features

The application includes powerful AI-driven insights powered by Google Gemini 3 Flash:

### AI Financial Coach
- Appears on the dashboard with real-time insights.
- Provides spending alerts, achievements, and coaching tips.
- Automatically rotates through multiple insights.
- Click Chat to open the full AI Assistant.

### AI Chat Assistant
- Natural language conversations about your finances.
- Context-aware responses based on your actual financial data.
- Ask questions like:
  - "How much did I spend on dining last month?"
  - "What are my top spending categories?"
  - "Give me tips to save more money."
  - "Am I on track with my budget?"

Note: AI features require a Gemini API key. Add it in Settings > Preferences > AI Integration.

## Deployment

### Vercel
The project is optimized for deployment on Vercel using Bun. Ensure your build settings use Bun for the fastest and most reliable deployment.

### Docker
Build and run with Docker Compose for production-grade hosting:
```bash
docker-compose up --build
```
The application will be accessible at http://localhost:8080.

## License
This project is free and open-source software licensed under the MIT License.
