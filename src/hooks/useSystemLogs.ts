import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatAction, generateHumanDescription } from "@/lib/log-formatter";
import type { LogEntry } from "@/types/api";

export type WsStatus = "connected" | "reconnecting" | "disconnected";

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

function computeStats(currentLogs: LogEntry[]): LogStats {
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const weekStart = new Date(todayStart);
	weekStart.setDate(weekStart.getDate() - 7);

	return currentLogs.reduce<LogStats>(
		(acc, curr) => {
			acc.total++;
			if (curr.action === "TRANSACTION_CREATED") acc.created++;
			if (curr.action === "TRANSACTION_EDITED") acc.edited++;
			if (curr.action === "TRANSACTION_DELETED") acc.deleted++;

			const logDate = new Date(curr.timestamp);
			if (logDate >= todayStart) acc.today++;
			if (logDate >= weekStart) acc.thisWeek++;
			return acc;
		},
		{ ...EMPTY_STATS },
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

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<number | null>(null);
	const disposedRef = useRef(false);
	const reconnectAttemptsRef = useRef(0);

	// Capped exponential backoff: 1s, 2s, 4s … max 30s.
	const RECONNECT_BASE_DELAY_MS = 1000;
	const RECONNECT_MAX_DELAY_MS = 30000;

	const updateStats = useCallback((currentLogs: LogEntry[]) => {
		setStats(computeStats(currentLogs));
	}, []);

	const fetchInitialData = useCallback(async () => {
		try {
			setLoading(true);
			const logsData = await api.systemLogs.list();
			const fetchedLogs = logsData.logs || [];
			setLogs(fetchedLogs);
			updateStats(fetchedLogs);
		} catch (err) {
			console.error("Failed to fetch logs:", err);
			toast.error("Failed to load system logs");
		} finally {
			setLoading(false);
		}
	}, [updateStats]);

	const connectWebSocket = useCallback(() => {
		if (disposedRef.current) return;

		if (wsRef.current) {
			wsRef.current.close();
		}

		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const isDev =
			window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1";
		const wsHost = isDev ? "localhost:3001" : window.location.host;
		const wsUrl = `${protocol}//${wsHost}/api/ws-logs`;
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
				setLogs((prev) => {
					const newLogs = [log, ...prev];
					updateStats(newLogs);
					return newLogs;
				});

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
	}, [updateStats]);

	useEffect(() => {
		disposedRef.current = false;
		fetchInitialData();
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
	}, [fetchInitialData, connectWebSocket]);

	return { logs, loading, stats, wsStatus, refresh: fetchInitialData };
}
