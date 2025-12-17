# Antigravity Finance

A premium, high-performance personal finance management OS designed for clarity and growth. Antigravity helps users track expenses, manage portfolios, and achieve financial goals with a focus on sophisticated design and intuitive user experience.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white)

## Features

- **Finance Intelligence Dashboard** - Real-time overview of financial health with modernized Shadcn UI charts for spending patterns and category breakdowns.
- **Eye Protection Light Mode** - Specialized warm-ivory theme designed to reduce blue light strain and provide a comfortable, paper-like reading experience.
- **Transaction Engine** - Precision recording of income, expenses, and internal transfers with CSV export and recurring logic support.
- **Budgeting OS** - Define and monitor spending limits per category with visual progress analytics and threshold alerts.
- **Wealth Goals** - Set sophisticated savings targets with deadline-based tracking and contribution history.
- **Activity Calendar** - High-fidelity visualization of daily financial events to identify spending outliers.
- **Unified Account View** - Seamless management of diverse asset types: Checking, Savings, Credit, Investments, and Cash.
- **Adaptive Categories** - Flexible, hierarchical category system with customizable visual identifiers.
- **Global Preferences** - Multi-currency support (USD, INR, EUR, etc.), regional date formats, and robust theme management.
- **PWA Ready** - Fully responsive design with Progressive Web App capabilities for native-like performance and offline access.

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 19, TypeScript, Vite 7 |
| **Styling** | Tailwind CSS 4, Shadcn UI (Radix UI) |
| **State Management** | React Context API |
| **Routing** | React Router DOM 7 |
| **Charts** | Shadcn UI Charts (Recharts Powered) |
| **Backend** | Supabase (PostgreSQL, Auth, RLS) |
| **Icons** | Lucide React |
| **PWA** | Vite PWA Plugin |
| **Aesthetics** | OKLCH Color Model, Glassmorphism, Custom Filters |

## Prerequisites

- Bun (Latest version)
- A Supabase account

## Installation

1. **Clone the repository**

    ```bash
    git clone <repository-url>
    cd antigravity-finance
    ```

2. **Install dependencies**

    ```bash
    bun install
    ```

3. **Environment Setup**

    Create a `.env` file in the root directory:

    ```bash
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4. **Database Initialization**

    - Execute `supabase/database.sql` in your Supabase SQL Editor.
    - Run `SELECT seed_my_data();` after your first login to populate the dashboard with demonstration data.

## Development

```bash
bun run dev
```

## Docker Deployment

Build and run with Docker Compose for production-grade hosting:

```bash
docker-compose up --build
```

The application will be accessible at `http://localhost:8080`.

## License

This project is licensed under the MIT License.
