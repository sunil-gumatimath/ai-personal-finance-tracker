# Personal Finance Tracker

A modern personal finance management application built with React 19, TypeScript, and Supabase.

## Features

- Interactive dashboard with real-time financial overview and charts
- Account management for checking, savings, investment, and credit accounts
- Transaction tracking with support for income, expenses, and transfers
- Recurring transaction management
- Financial calendar with monthly income and expense visualization
- Budget creation and spending limit tracking
- Savings goals with progress monitoring
- Secure authentication powered by Supabase
- Responsive design with dark mode support
- CSV export functionality for data portability
- Progressive Web App (PWA) capabilities
- Docker containerization for production deployment

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, Shadcn UI, Lucide Icons
- **Backend**: Supabase
- **Charts**: Recharts
- **Runtime**: Bun
- **Deployment**: Docker, Nginx

## Getting Started

### Prerequisites

- Bun (v1.0+)
- Docker (optional, for containerization)
- Supabase project

### Local Development

1. Clone the repository and install dependencies:
   ```bash
   git clone <repository-url>
   cd personal-finance-tracker
   bun install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Configure your Supabase credentials in `.env`:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. Initialize the database:
   - Access your Supabase project's SQL Editor
   - Execute the schema script in `supabase/database.sql`

4. Start the development server:
   ```bash
   bun run dev
   ```
   Access the application at `http://localhost:5173`

### Docker Deployment

1. Build and run with Docker Compose:
   ```bash
   docker-compose up --build -d
   ```

2. Access the application at `http://localhost:8080`

## Project Structure

```
src/
├── components/     # Reusable UI components
├── contexts/       # React contexts for state management
├── hooks/          # Custom React hooks
├── lib/            # Utility functions and configurations
├── pages/          # Main application pages
├── types/          # TypeScript type definitions
└── App.tsx         # Main application component
```