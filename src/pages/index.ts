import { lazy, type ComponentType } from "react";

// Eagerly loaded — needed on first render
export { Login } from "./Login";
export { Signup } from "./Signup";
export { ForgotPassword } from "./ForgotPassword";

// ---------------------------------------------------------------------------
// lazyWithRetry — stale-chunk recovery for lazy routes.
// After a redeploy, a cached old index.html / service worker can reference
// hashed chunks (e.g. Dashboard-DD9uZ603.js) that no longer exist on the CDN.
// A plain React.lazy() then rejects with "Failed to fetch dynamically
// imported module" and the route suspends forever (vite:preloadError does NOT
// fire for React.lazy imports). On a chunk-load failure we unregister stale
// service workers, clear caches, and reload ONCE per chunk per minute — a
// second failure propagates to the ErrorBoundary instead of loop-reloading.
// ---------------------------------------------------------------------------
const RELOAD_KEY_PREFIX = "pft-chunk-reloaded:";
const RELOAD_COOLDOWN_MS = 60_000;

function isChunkLoadError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError|Cannot find module|Failed to load/i.test(
		message,
	);
}

function shouldRetryChunk(key: string): boolean {
	try {
		const last = Number(sessionStorage.getItem(RELOAD_KEY_PREFIX + key) ?? 0);
		if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
		sessionStorage.setItem(RELOAD_KEY_PREFIX + key, String(Date.now()));
		return true;
	} catch {
		// Storage unavailable (private mode) — still attempt one reload.
		return true;
	}
}

function bustStaleWorkerAndReload(): void {
	const done = () => window.location.reload();
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker
			.getRegistrations()
			.then((regs) => Promise.all(regs.map((r) => r.unregister())))
			.catch(() => undefined)
			.finally(() => {
				if ("caches" in window) {
					caches
						.keys()
						.then((names) => Promise.all(names.map((n) => caches.delete(n))))
						.catch(() => undefined)
						.finally(done);
				} else {
					done();
				}
			});
	} else {
		done();
	}
}

function lazyWithRetry<T extends ComponentType<any>>(
	key: string,
	importer: () => Promise<{ default: T }>,
) {
	return lazy(() =>
		importer().catch((error: unknown) => {
			if (!isChunkLoadError(error) || !shouldRetryChunk(key)) throw error;
			bustStaleWorkerAndReload();
			// Suspend until the reload happens; the fresh bundle takes over.
			return new Promise<{ default: T }>(() => {});
		}),
	);
}

// Lazy-loaded — only fetched when the user navigates to these routes
// This reduces the initial bundle size significantly (bundle-dynamic-imports)
export const Dashboard = lazyWithRetry("dashboard", () =>
	import("./Dashboard").then((m) => ({ default: m.Dashboard })),
);
export const Transactions = lazyWithRetry("transactions", () =>
	import("./Transactions").then((m) => ({ default: m.Transactions })),
);
export const Budgets = lazyWithRetry("budgets", () =>
	import("./Budgets").then((m) => ({ default: m.Budgets })),
);
export const Categories = lazyWithRetry("categories", () =>
	import("./Categories").then((m) => ({ default: m.Categories })),
);
export const Accounts = lazyWithRetry("accounts", () =>
	import("./Accounts").then((m) => ({ default: m.Accounts })),
);
export const Goals = lazyWithRetry("goals", () =>
	import("./Goals").then((m) => ({ default: m.Goals })),
);
export const Debts = lazyWithRetry("debts", () =>
	import("./Debts").then((m) => ({ default: m.Debts })),
);
export const Settings = lazyWithRetry("settings", () =>
	import("./Settings").then((m) => ({ default: m.Settings })),
);
export const Calendar = lazyWithRetry("calendar", () =>
	import("./Calendar").then((m) => ({ default: m.Calendar })),
);
export const SystemLogs = lazyWithRetry("system-logs", () =>
	import("./SystemLogs").then((m) => ({ default: m.SystemLogs })),
);
export const Reports = lazyWithRetry("reports", () =>
	import("./Reports").then((m) => ({ default: m.Reports })),
);
export const Digest = lazyWithRetry("digest", () =>
	import("./Digest").then((m) => ({ default: m.Digest })),
);

// ---------------------------------------------------------------------------
// Shared route metadata — single source of truth for navigation vocabulary.
// Used by App.tsx (document titles), Header.tsx (breadcrumbs/title) and
// AppSidebar.tsx so every surface uses the SAME short label per route.
// ---------------------------------------------------------------------------
export const ROUTE_TITLES: Record<string, string> = {
	"/": "Dashboard",
	"/digest": "AI Digest",
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
