# How to Use AI Personal Finance Tracker

Welcome to **AI Personal Finance Tracker**, your personal finance companion for tracking transactions, managing budgets, monitoring goals, paying down debt, and getting AI-powered financial guidance.

## Getting Started

### 1. Sign Up, Log In, and Reset Passwords

- **New users**: Choose **Sign Up**, then enter your full name, email, and password.
- **Returning users**: Log in with your existing email and password.
- **Forgot password**: Use the password reset flow on the login screen.
- **Privacy**: Your records are scoped to your account. Other users cannot view your finances.

### 2. Configure Your Preferences

Open **Settings** after your first login and review:

- Theme: Light, Dark, or System.
- Accent color: Default or Emerald.
- Currency: USD, INR, EUR, GBP, or JPY.
- Date format: choose the format that matches your region.
- AI provider: KiloCode, if you want AI insights and chat.

---

## Dashboard

The Dashboard is your home base for a fast overview of your finances.

- **Add Transaction shortcut**: The header button jumps straight into the new-transaction form on the Transactions page.
- **Stats cards**: Total balance, monthly income, monthly expenses, and monthly net — income and expenses show how they compare to last month when there is a baseline to compare against.
- **Financial Health Score**: A score built from savings rate (40%), budget adherence (30%), and emergency fund progress (30%), with a breakdown and next steps.
- **Spending Flow**: Category-level spending for this month compared with last month.
- **Income vs. Expenses Chart**: Trend view across recent months.
- **Recent Transactions**: Quickly review your newest financial activity.
- **AI Coach**: AI-generated coaching cards, kudos, and spending alerts when AI is configured. Cards you do not want can be dismissed individually.
- **AI Assistant**: A floating chat bubble available on every page — ask about your balances, spending, budgets, goals, debt, and trends. Conversations are stored locally in your browser and can be cleared from the chat header.

---

## System Logs

The sidebar's **System Logs** entry opens your personal activity feed: every transaction created, edited, or deleted, plus account changes, sign-ins, recurring runs, and system errors. A **Live** badge shows the stream is connected; summary cards count events by type, day, and week. Search the log, filter by action, severity, or date range, click an entry for full details, and use **Export** to download what you see as JSON or CSV.

---

## Features Guide

### 1. Transactions

Use **Transactions** to record money moving in and out.

- **Add transaction**: Click **Add Transaction** to open a form dialog where you:
  - Choose **Income**, **Expense**, or **Transfer**.
  - Enter amount, date, description, account, and category when applicable (category options follow the type you picked).
  - For transfers, choose both the source and destination account.
  - Close with unsaved edits and the app asks before discarding them.
- **Recurring transactions**: In the same dialog, mark repeating items such as rent, subscriptions, or salary as recurring, choose a daily, weekly, monthly, or yearly frequency, and optionally set an **end date**. The next occurrence is generated automatically (daily 03:00 UTC cron in production, or the **Process Recurring** button on this page) and appears as a normal transaction you can edit or delete. Recurring rows carry a badge showing their frequency in the table.
- **Add with AI**: Type a sentence like *"paid $45 for groceries yesterday"* or *"salary of $2,000 on the 1st"* into the **Add with AI** box and press **Parse** — the assistant fills the dialog for you to review before saving.
- **Search and filter**: Search matches descriptions, categories, accounts, and amounts; the type dropdown filters income, expense, and transfers. Both live in the URL, so filtered views survive a refresh and can be shared. A "Showing X of Y" counter tracks what your filters matched.
- **Sort and paginate**: Click the Description, Category, Date, or Amount column headers to sort (click again to reverse), and pick a page size of 25, 50, or 100 rows at the bottom of the table. On small screens the table becomes cards instead.
- **Edit or delete**: Open the actions menu (three dots) on any row. Deleting asks you to confirm first.
- **Export CSV**: Download the currently visible transactions for use in spreadsheets.

### 2. Calendar

Use **Calendar** to visualize activity by day.

- Days with activity show income and expense indicators.
- Click a date to inspect transactions for that day.
- Navigate month by month or jump back to today.

### 3. Budgets

Use **Budgets** to set limits by category.

- Create limits for weekly, monthly, or yearly spending periods with the **Create Budget** button.
- Overview cards at the top total your budgets and spending; weekly and yearly periods are normalized into a monthly equivalent so mixed-period totals stay honest.
- Watch progress bars change as you approach limits — they turn amber near the limit and red when exceeded, with an **Approaching** badge and an "over by" amount on over-budget cards.
- Edit or delete any budget from its card (deletion asks for confirmation).

### 4. Goals

Use **Goals** to track savings targets.

- Create a goal with a name, target amount, deadline, and an optional color and icon.
- Add contributions as you save.
- Monitor progress visually until the goal is complete — completed goals get a celebratory highlight.
- Summary cards track active goals, completions, total saved, and overall progress.

### 5. Debts

Use **Debts** to manage loans, cards, and payoff planning.

- **Summary Dashboard**: Cards show total remaining vs. original borrowed, your overall payoff progress ring, combined monthly minimums, and a weighted-average APR across active debts.
- **Add & Track Debts**: Add loans (mortgage, car loan, student loan, personal, credit card, medical, etc.) with their interest rate, minimum payment, due day, and lender. Each card shows payoff progress, minimum payment, due date, estimated payoff time at minimums, and an "interest warning" when your minimum will never clear the balance. Active and paid-off debts live on separate tabs; you can also mark a debt as paid off from its action menu.
- **Payment Log**: Expand any debt card to record payments — split by principal and interest (leave the split blank to auto-split against the amount), with optional notes — and review your full payment timeline. Recording a payment reduces that debt's balance.
- **Interactive Payoff Planner**: With more than one active debt, click **Payoff Planner** (or **Compare Strategies**) to open the simulation suite.
  - **Extra Payment Slider & Input**: Drag the slider or type an amount to add an extra monthly payment (the range scales with your total minimums) and watch your payoff timeline shrink.
  - **Payoff Balance Projection Chart**: Visualize projected remaining balances month by month for three paths: minimums only, Snowball, and Avalanche. If minimums alone can never repay the debt, the dashed Minimums line stays flat instead of vanishing.
  - **Strategy Comparison**: Side-by-side cards compare **Minimums Only**, **Debt Snowball** (lowest balance first), and **Debt Avalanche** (highest interest first), including months-to-freedom, total interest, and what each strategy saves you. Tabs below list the exact payoff order for both strategies, and a recommendation panel names the method that saves you the most.
  - **Payoff Progress Rings**: Track the paid-off percentage for each individual debt and your overall portfolio.

### 6. Accounts

Use **Accounts** to manage where your money is held.

- Track checking, savings, credit, investment, cash, and other accounts.
- Search by name, filter by type, and sort by name, balance, type, or newest — active and inactive accounts are grouped separately, and you can toggle an account's active status when editing it.
- Keep balances aligned with your real-world accounts.
- Use transfers to move money between accounts without treating the movement as income or expense.

### 7. Categories

Use **Categories** to organize transactions.

- **Built-in & Custom Categories**: Start from default categories or create custom ones tailored to your budget.
- **Visual Category Creator**: Add categories using a color palette and an interactive icon picker.
- **Live Preview**: See how the category tile will appear on the dashboard in real-time as you type, select colors, and pick icons.
- **Category Metrics**: Instantly view metrics at the top of the Categories page, including total category counts, type breakdowns, and most-used categories.
- **Consistency**: Keep category names clean and consistent to ensure accurate budgets, analytics charts, and AI-powered coach answers.

---

## AI Features

### AI Provider Setup

Go to **Settings > Preferences > AI Integration**.

- Get your free Kilo Gateway API key at app.kilo.ai (Your Profile → API key at the bottom of the page), then paste it here. Toggle visibility with the eye icon next to the field. Keys are encrypted and stored server-side; the field stays empty once a key is saved.
- Pick a model from the curated free-model dropdown — each entry shows its context size and a short description (default `inclusionai/ling-3.0-flash:free`). Only free Kilo Gateway models can be selected.
- Click **Save AI Settings**.
- To try the AI features without a real key, use `demo-key` for sample responses.
- Privacy note: answering your questions sends your financial data (balances, transactions, budgets, goals, debts) to the KiloCode API.

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

### Weekly AI Digest

On the dashboard, the **Weekly AI Digest** card summarizes your week: income vs. spending, top categories, budget status, goal/debt progress, and one tailored tip. Click **Generate** (or **Regenerate**) to create or refresh it for the current week. Use the **eye icon** to hide or show the digest once it has been generated — your choice is remembered across sessions.

### Reports

Open **Reports** from the sidebar and switch between a single **Month** (with previous/next arrows) or the **Last 12 months**. Each view summarizes income vs. expenses, net savings, savings rate, spending by category, account balances, and the period's transactions; very large histories are capped at the most recent 1,000 transactions. Export the current period as a formatted **PDF** or **CSV**.

---

## Settings

Settings is organized into four tabs: **Profile**, **Preferences**, **Alerts**, and **Security**.

### Profile

- Update your full name (the profile badge dynamically derives and displays your initials based on your name).
- View your registered email.

### Preferences

**Interface** changes apply instantly:

- Theme: Light, Dark, or System.
- Accent color: Default or Emerald.
- Currency: USD ($), EUR (€), GBP (£), INR (₹), or JPY (¥).
- Date format: MM/DD/YYYY, DD/MM/YYYY, or YYYY-MM-DD.

The **AI Integration** block on this tab configures your KiloCode key and model — see [AI Provider Setup](#ai-provider-setup) above.

### Alerts

Toggle notification preferences on or off (saved as you flip them):

- Push notifications for important events.
- Weekly digest email summaries.
- Budget alerts when spending exceeds limits.

### Security

- **Reset Password**: Send a reset link to your email.
- **Sign Out**: End your current session (also available from the header avatar menu).
- **Delete Account**: In the Danger Zone — permanently deletes your account and wipes all financial data from the servers. You will be asked to confirm first; this cannot be undone.

---

## Mobile App / PWA

AI Personal Finance Tracker can be installed as a Progressive Web App.

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
