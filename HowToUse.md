# How to Use FinanceTrack

Welcome to **FinanceTrack**, your personal finance companion for tracking transactions, managing budgets, monitoring goals, paying down debt, and getting AI-powered financial guidance.

## Getting Started

### 1. Sign Up, Log In, and Reset Passwords
- **New users**: Choose **Sign Up**, then enter your full name, email, and password.
- **Returning users**: Log in with your existing email and password.
- **Forgot password**: Use the password reset flow on the login screen.
- **Privacy**: Your records are scoped to your account. Other users cannot view your finances.

### 2. Configure Your Preferences
Open **Settings** after your first login and review:
- Theme: Light, Dark, or System.
- Currency: USD, INR, EUR, GBP, or JPY.
- Date format: choose the format that matches your region.
- AI provider: Gemini or OpenRouter, if you want AI insights and chat.

---

## Dashboard

The Dashboard is your home base for a fast overview of your finances.

- **Stats cards**: Total balance, monthly income, monthly expenses, and savings.
- **Financial Health Score**: A score based on savings rate, budget adherence, and emergency fund progress.
- **Spending Flow / Budget Overview**: Category-level spending progress and budget awareness.
- **Income vs. Expenses Chart**: Trend view across recent months.
- **Recent Transactions**: Quickly review your newest financial activity.
- **AI Coach**: AI-generated coaching cards, kudos, and spending alerts when AI is configured.
- **AI Assistant**: Chat about your balances, spending, budgets, goals, debt, and trends.

---

## Features Guide

### 1. Transactions
Use **Transactions** to record money moving in and out.

- **Add transaction**:
  - Choose **Income**, **Expense**, or **Transfer**.
  - Enter amount, date, description, account, and category when applicable.
  - For transfers, choose both the source and destination account.
- **Recurring metadata**: Mark repeating items such as rent, subscriptions, or salary as recurring and choose the frequency.
- **Search and filter**: Search by description or category and filter by transaction type.
- **Edit or delete**: Use the row actions to correct or remove entries.
- **Export CSV**: Download the currently visible transactions for use in spreadsheets.

### 2. Calendar
Use **Calendar** to visualize activity by day.

- Days with activity show income and expense indicators.
- Click a date to inspect transactions for that day.
- Navigate month by month or jump back to today.

### 3. Budgets
Use **Budgets** to set limits by category.

- Create limits for weekly, monthly, or yearly spending periods.
- Watch progress bars change as you approach or exceed limits.
- Use dashboard budget insights to identify categories that need attention.

### 4. Goals
Use **Goals** to track savings targets.

- Create a goal with a name, target amount, and deadline.
- Add contributions as you save.
- Monitor progress visually until the goal is complete.

### 5. Debts
Use **Debts** to manage loans, cards, and payoff planning.

- **Add & Track Debts**: Add loans (mortgage, car loan, student loan, personal, credit card, medical, etc.) with their interest rate, minimum payment, due date, and lender.
- **Payment Log**: Record payment history, split by principal and interest, to accurately track decreasing balances.
- **Interactive Payoff Planner**: Click the **Payoff Planner** button to open the simulation suite.
  - **Extra Contribution Slider**: Drag the slider to add an extra monthly payment (using your budget surplus) and watch your payoff timeline shrink.
  - **Payoff Balance Projection Chart**: Visualize how different payment amounts collapse your debt balances over time.
  - **Strategy Comparison**: Side-by-side comparison of **Debt Snowball** (paying lowest balance first) vs. **Debt Avalanche** (paying highest interest rate first) to see which strategy saves the most time and interest.
  - **Payoff Progress Rings**: Visually track the paid-off percentage for each individual debt and your overall debt portfolio.

### 6. Accounts
Use **Accounts** to manage where your money is held.

- Track checking, savings, credit, investment, and cash accounts.
- Keep balances aligned with your real-world accounts.
- Use transfers to move money between accounts without treating the movement as income or expense.

### 7. Categories
Use **Categories** to organize transactions.

- **Built-in & Custom Categories**: Start from default categories or create custom ones tailored to your budget.
- **Visual Category Creator**: Add categories using a curated color palette and an interactive icon picker.
- **Live Preview**: See how the category tile will appear on the dashboard in real-time as you type, select colors, and pick icons.
- **Category Metrics**: Instantly view metrics at the top of the Categories page, including total category counts, type breakdowns, and most-used categories.
- **Consistency**: Keep category names clean and consistent to ensure accurate budgets, analytics charts, and AI-powered coach answers.

---

## AI Features

### AI Provider Setup
Go to **Settings > Preferences > AI Integration**.

- Choose **Gemini (Google)** or **OpenRouter (Multi-Model)**.
- Paste the matching API key. You can toggle the key visibility (show/hide) using the eye icon next to the input field.
  - Gemini keys usually start with `AIza`.
  - OpenRouter keys usually start with `sk-or-`.
- Select a Gemini model or enter an OpenRouter model slug such as `openrouter/free`.
- Save your preferences.

### AI Coach
The AI Coach can provide:
- Spending alerts.
- Anomaly detection.
- Positive reinforcement when you are doing well.
- Next-step coaching based on your recent financial data.

### AI Assistant
Ask natural-language questions such as:
- “How much did I spend on food last month?”
- “What is my total account balance?”
- “Am I on track with my savings goals?”
- “How much debt do I have left?”
- “What is my net worth?”
- “Compare my spending this month vs last month.”

---

## Settings

### Profile
- Update your full name (the user profile badge dynamically derives and displays your initials based on your name).
- View your registered email.

### Preferences
- Theme: Light, Dark, or System.
- Currency: USD, INR, EUR, GBP, or JPY.
- Date format: choose your preferred display style.

### AI Integration
- Choose Gemini or OpenRouter.
- Save your API key and model preference.
- Use AI-powered dashboard insights and assistant chat.

### Notifications
- Enable browser notifications when supported.
- Configure budget and summary alert preferences.

### Security
- Request password reset emails.
- Sign out securely when finished.

---

## Mobile App / PWA

FinanceTrack can be installed as a Progressive Web App.

- **iOS**: Open the app in Safari, tap Share, then choose **Add to Home Screen**.
- **Android**: Open the app in Chrome, open the menu, then choose **Install App**.
- **Desktop browsers**: Use the install icon in the address bar when available.

---

## Tips for Best Results

- Add accounts before entering transactions so every record has a source.
- Keep categories clean and consistent for better reporting.
- Review budgets weekly to prevent overspending.
- Record debt payments with principal and interest when possible.
- Configure AI only with keys you control; do not paste someone else’s API key.
