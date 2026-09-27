import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatAction, generateHumanDescription } from "@/lib/log-formatter";
import type { LogEntry } from "@/types/api";

export type WsStatus = "connected" | "reconnecting" | "disconnected";

/**
 * Client-side cap on retained log entries.
 *
 * The REST path is capped server-side (`DEFAULT_LIMIT` in logs.routes.ts) but
 * the WebSocket path prepended entries without limit, so a long-lived dev tab
 * grew the array forever — and because `computeStats` is an O(n) reduce run per
 * message, every streamed event got progressively more expensive.
 */
const MAX_CLIENT_LOGS = 500;

export interface LogStats {
	total: number;
	created: number;
	edited: number;
	deleted: number;
	today: number;
	thisWeek: number;
}

const EMPTY_STATS: LogStats = {
	total: 0,
	created: 0,
	edited: 0,
	deleted: 0,
	today: 0,
	thisWeek: 0,
};

/**
 * WebSocket live updates only exist behind the local Bun server
 * (`api/_server.ts` serves /api/ws-logs). Vercel serverless has no
 * long-lived socket support, so the feed is unavailable in production and the
 * page must present that as a supported mode — not as a broken connection.
 */
export function isLiveFeedSupported(): boolean {
	if (typeof window === "undefined") return false;
	const { hostname } = window.location;
	return hostname === "localhost" || hostname === "127.0.0.1";
}

function computeStats(
	currentLogs: LogEntry[],
	totalOverride?: number,
): LogStats {
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	// "Last 7 days", matching the date-range filter label — NOT calendar weeks.
	const weekStart = new Date(todayStart);
	weekStart.setDate(weekStart.getDate() - 7);

	return currentLogs.reduce<LogStats>(
		(acc, curr) => {
			// `total` is the server's pre-limit match count for the user's scope;
			// every other counter is derived from the loaded window. The page
			// states this explicitly so the two scopes are never confused.
			acc.total = Math.max(acc.total, totalOverride ?? 0);
			if (curr.action === "TRANSACTION_CREATED") acc.created++;
			if (curr.action === "TRANSACTION_EDITED") acc.edited++;
			if (curr.action === "TRANSACTION_DELETED") acc.deleted++;

			const logDate = new Date(curr.timestamp);
			if (logDate >= todayStart) acc.today++;
			if (logDate >= weekStart) acc.thisWeek++;
			return acc;
		},
		{ ...EMPTY_STATS, total: totalOverride ?? 0 },
	);
}

/**
 * Owns the system-logs data flow: initial fetch, live WebSocket feed with
 * automatic reconnect, and derived summary stats. The page stays purely
 * presentational.
 */
export function useSystemLogs() {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState<LogStats>(EMPTY_STATS);
	const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
	const [error, setError] = useState<string | null>(null);
	const [liveSupported, setLiveSupported] = useState(false);

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<number | null>(null);
	const disposedRef = useRef(false);
	const reconnectAttemptsRef = useRef(0);
	// Server-reported total for the user's scope (before the fetch limit);
	// bumped on every live push so "Total Events" stays truthful.
	const serverTotalRef = useRef(0);

	// Capped exponential backoff: 1s, 2s, 4s … max 30s.
	const RECONNECT_BASE_DELAY_MS = 1000;
	const RECONNECT_MAX_DELAY_MS = 30000;

	// Mirror of `logs` so the socket handler can compute the next list without
	// reading (and therefore depending on) state.
	const logsRef = useRef<LogEntry[]>([]);

	/**
	 * Request generation counter.
	 *
	 * Without it, two overlapping `fetchInitialData()` calls (a manual refresh
	 * plus a remount, or StrictMode's double-invoke) raced, and whichever
	 * resolved last won regardless of order.
	 */
	const fetchSeqRef = useRef(0);

	const updateStats = useCallback((currentLogs: LogEntry[]) => {
		setStats(computeStats(currentLogs, serverTotalRef.current));
	}, []);

	/**
	 * Initial fetch / manual refresh. Returns whether it succeeded so callers
	 * can show exactly one accurate toast; the error is also exposed via
	 * `error` so the page can render an ErrorState instead of an empty state.
	 */
	const fetchInitialData = useCallback(async (): Promise<boolean> => {
		const seq = ++fetchSeqRef.current;
		try {
			setLoading(true);
			const logsData = await api.systemLogs.list();
			// A newer request already started; its response is the one that counts.
			if (seq !== fetchSeqRef.current) return false;
			const fetchedLogs = logsData.logs || [];
			serverTotalRef.current =
				logsData.total ?? serverTotalRef.current ?? fetchedLogs.length;
			logsRef.current = fetchedLogs;
			setLogs(fetchedLogs);
			updateStats(fetchedLogs);
			setError(null);
			return true;
		} catch (err) {
			if (seq !== fetchSeqRef.current) return false;
			console.error("Failed to fetch logs:", err);
			setError(
				err instanceof Error
					? err.message
					: "We couldn't reach the activity log service.",
			);
			return false;
		} finally {
			if (seq === fetchSeqRef.current) setLoading(false);
		}
	}, [updateStats]);

	const connectWebSocket = useCallback(() => {
		if (disposedRef.current) return;

		// Production (Vercel serverless) has no WebSocket support — /api/ws-logs
		// would just 404 and reconnect-forever. Skip WS entirely outside dev;
		// `liveSupported` lets the page show a neutral "manual refresh" pill
		// instead of a red OFFLINE one. The page still works via the initial
		// fetch + manual refresh.
		if (!liveSupported) {
			setWsStatus("disconnected");
			return;
		}

		if (wsRef.current) {
			wsRef.current.close();
		}

		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		// Derive the API origin from the page so dev over LAN / a custom dev
		// domain still reaches the socket instead of a hardcoded localhost.
		const apiOrigin =
			import.meta.env.VITE_API_ORIGIN?.trim() || "http://localhost:3001";
		const wsUrl = `${protocol}//${apiOrigin.replace(/^https?:/, "")}/api/ws-logs`;
		setWsStatus("reconnecting");

		const socket = new WebSocket(wsUrl);
		wsRef.current = socket;

		socket.onopen = () => {
			setWsStatus("connected");
			// Successful open — reset the backoff sequence.
			reconnectAttemptsRef.current = 0;
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = null;
			}
		};

		socket.onmessage = (event) => {
			try {
				const log: LogEntry = JSON.parse(event.data);
				serverTotalRef.current += 1;
				// `setLogs` now caps the array, and `updateStats` is called with
				// the SAME capped list that is stored.
				//
				// It used to run `updateStats` from INSIDE the `setLogs` updater
				// function, which must be pure: React is free to re-invoke
				// updaters (StrictMode double-invokes every one, and concurrent
				// rendering can replay them), so `setStats` could fire during
				// the render phase. Under StrictMode it also double-fired on
				// every single streamed message.
				//
				// The array also grew without bound — the REST path caps at 200
				// (`DEFAULT_LIMIT` in logs.routes.ts) but the socket path
				// prepended forever, making every message an O(n) reduce plus an
				// O(n) re-filter in the page, for the life of the tab.
				const nextLogs = [log, ...logsRef.current].slice(0, MAX_CLIENT_LOGS);
				logsRef.current = nextLogs;
				setLogs(nextLogs);
				updateStats(nextLogs);

				if (log.severity === "critical") {
					toast.error(`Critical Event: ${formatAction(log.action)}`, {
						description: generateHumanDescription(log),
						duration: 8000,
					});
				} else if (log.severity === "error") {
					toast.error(`Error: ${formatAction(log.action)}`, {
						description: generateHumanDescription(log),
						duration: 6000,
					});
				} else if (log.severity === "warning") {
					toast.warning(`Warning: ${formatAction(log.action)}`, {
						duration: 4000,
					});
				}
			} catch (err) {
				console.error("Failed to parse WebSocket message:", err);
			}
		};

		socket.onclose = (event) => {
			// Never reschedule after unmount — this is what caused the zombie
			// reconnect loop (cleanup closed the socket, but the async onclose
			// callback still fired and scheduled a fresh connection forever).
			if (disposedRef.current) return;

			// Respect clean closures: the remote end intentionally closed the
			// feed (e.g. graceful shutdown), so stop instead of hammering it.
			// Abnormal closes (crash, network drop) reconnect with backoff.
			if (event.wasClean) {
				setWsStatus("disconnected");
				return;
			}

			setWsStatus("reconnecting");
			const delay = Math.min(
				RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttemptsRef.current,
				RECONNECT_MAX_DELAY_MS,
			);
			reconnectAttemptsRef.current += 1;
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			reconnectTimeoutRef.current = window.setTimeout(() => {
				connectWebSocket();
			}, delay);
		};

		socket.onerror = () => {
			socket.close();
		};
	}, [updateStats, liveSupported]);

	// Initial data fetch: runs ONCE on mount.
	//
	// This used to share an effect with the socket, whose callback closes over
	// `liveSupported` — and `setLiveSupported(...)` was called from inside that
	// same effect. So on localhost the effect ran twice: once with
	// `liveSupported === false` (socket early-returned, fetch fired as request
	// A), then again after state settled (fetch fired as request B). Two
	// `GET /api/system-logs` per page load in dev, two `setLoading` cycles, and
	// A/B racing each other. In production `isLiveFeedSupported()` returns
	// false and `setLiveSupported(false)` bails out on `Object.is`, so it
	// happened to be single-fetch there.
	//
	// A data concern gating a connection concern through one effect was the
	// root cause; they are now separate.
	useEffect(() => {
		void fetchInitialData();
	}, [fetchInitialData]);

	// Socket lifecycle: depends on `liveSupported`, which is set once here.
	useEffect(() => {
		setLiveSupported(isLiveFeedSupported());
	}, []);

	useEffect(() => {
		disposedRef.current = false;
		connectWebSocket();

		return () => {
			disposedRef.current = true;
			if (wsRef.current) {
				// Detach handlers first so this intentional close cannot
				// trigger a reconnect.
				wsRef.current.onclose = null;
				wsRef.current.onerror = null;
				wsRef.current.close();
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = null;
			}
		};
	}, [connectWebSocket]);

	return { logs, loading, stats, wsStatus, liveSupported, error, refresh: fetchInitialData };
}
