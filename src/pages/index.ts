import { lazy } from "react";

// Eagerly loaded — needed on first render
export { Login } from "./Login";
export { Signup } from "./Signup";
export { ForgotPassword } from "./ForgotPassword";

// Lazy-loaded — only fetched when the user navigates to these routes
// This reduces the initial bundle size significantly (bundle-dynamic-imports)
export const Dashboard = lazy(() =>
	import("./Dashboard").then((m) => ({ default: m.Dashboard })),
);
export const Transactions = lazy(() =>
	import("./Transactions").then((m) => ({ default: m.Transactions })),
);
export const Budgets = lazy(() =>
	import("./Budgets").then((m) => ({ default: m.Budgets })),
);
export const Categories = lazy(() =>
	import("./Categories").then((m) => ({ default: m.Categories })),
);
export const Accounts = lazy(() =>
	import("./Accounts").then((m) => ({ default: m.Accounts })),
);
export const Goals = lazy(() =>
	import("./Goals").then((m) => ({ default: m.Goals })),
);
export const Debts = lazy(() =>
	import("./Debts").then((m) => ({ default: m.Debts })),
);
export const Settings = lazy(() =>
	import("./Settings").then((m) => ({ default: m.Settings })),
);
export const Calendar = lazy(() =>
	import("./Calendar").then((m) => ({ default: m.Calendar })),
);
export const SystemLogs = lazy(() =>
	import("./SystemLogs").then((m) => ({ default: m.SystemLogs })),
);
export const Reports = lazy(() =>
	import("./Reports").then((m) => ({ default: m.Reports })),
);

// ---------------------------------------------------------------------------
// Shared route metadata — single source of truth for navigation vocabulary.
// Used by App.tsx (document titles), Header.tsx (breadcrumbs/title) and
// AppSidebar.tsx so every surface uses the SAME short label per route.
// ---------------------------------------------------------------------------
export const ROUTE_TITLES: Record<string, string> = {
	"/": "Dashboard",
	"/transactions": "Transactions",
	"/reports": "Reports",
	"/calendar": "Calendar",
	"/budgets": "Budgets",
	"/goals": "Goals",
	"/debts": "Debts",
	"/accounts": "Accounts",
	"/categories": "Categories",
	"/system-logs": "System Logs",
	"/settings": "Settings",
};

/** Brand suffix for document titles, e.g. "Dashboard · FinanceTrack". */
export const APP_BRAND = "FinanceTrack";

/** Base document title — must match the <title> in index.html. */
export const APP_TITLE = "Personal Finance Tracker";
