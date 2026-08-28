import type {
	AuthResponse,
	LogoutResponse,
	ProfileResponse,
	ProfileUpdateResponse,
	ProfileUpdatePayload,
	AccountsListResponse,
	AccountResponse,
	AccountCreatePayload,
	AccountUpdatePayload,
	LinkedCountResponse,
	CategoriesListResponse,
	CategoryResponse,
	CategoryPayload,
	TransactionsListResponse,
	TransactionResponse,
	TransactionCreatePayload,
	TransactionUpdatePayload,
	BudgetsListResponse,
	BudgetResponse,
	BudgetPayload,
	GoalsListResponse,
	GoalResponse,
	GoalPayload,
	DebtsListResponse,
	DebtResponse,
	DebtPayload,
	DebtPaymentsListResponse,
	DebtPaymentResponse,
	DebtPaymentPayload,
	AiInsightsResponse,
	AiChatResponse,
	AiParseResponse,
	AiDigestResponse,
	ProcessRecurringResponse,
	NotificationData,
	NotificationActionResponse,
	OkResponse,
	SystemLogsResponse,
} from "@/types";
import { ApiError } from "@/lib/errors";

async function apiFetch<T>(
	path: string,
	options?: RequestInit,
): Promise<T> {
	const headers = new Headers(options?.headers);
	if (!headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	let res: Response;
	try {
		res = await fetch(path, {
			...options,
			headers,
			credentials: "include",
		});
	} catch {
		// fetch() rejects on network failures (offline, server down, DNS
		// issues) with a raw TypeError. Convert it to a typed ApiError so
		// callers get a friendly message and isRetryable() works.
		throw new ApiError("Network error — please check your connection and try again.", {
			status: 0,
			code: "NETWORK_ERROR",
		});
	}

	if (!res.ok) {
		const error = await ApiError.fromResponse(res);
		// Global 401/403 handling: let AuthContext sign the user out and
		// redirect, unless the failure happened on an auth page itself.
		if (
			error.isAuthError &&
			!isPublicAuthRoute(window.location.pathname)
		) {
			window.dispatchEvent(new CustomEvent("app:session-expired"));
		}
		throw error;
	}

	return (await res.json()) as T;
}

/** Routes where an auth error is expected and must not force a redirect loop. */
function isPublicAuthRoute(pathname: string): boolean {
	return ["/login", "/signup", "/forgot-password"].includes(pathname);
}

/** Default client timeout (ms) for AI requests so a hung upstream doesn't spin forever (M6). */
const API_DEFAULT_TIMEOUT_MS = 1000 * 60;

export const api = {
	auth: {
		me: () => apiFetch<AuthResponse>("/api/auth?action=me"),
		login: (email: string, password: string) =>
			apiFetch<AuthResponse>("/api/auth?action=login", {
				method: "POST",
				body: JSON.stringify({ email, password }),
			}),
		signup: (email: string, password: string, fullName: string) =>
			apiFetch<AuthResponse>("/api/auth?action=signup", {
				method: "POST",
				body: JSON.stringify({ email, password, fullName }),
			}),
		sync: (fullName: string) =>
			apiFetch<OkResponse>("/api/auth?action=sync", {
				method: "POST",
				body: JSON.stringify({ fullName }),
			}),
		logout: () =>
			apiFetch<LogoutResponse>("/api/auth?action=logout", { method: "POST" }),
		deleteAccount: () =>
			apiFetch<OkResponse>("/api/auth?action=delete-account", {
				method: "DELETE",
			}),
	},
	profile: {
		get: () => apiFetch<ProfileResponse>("/api/profile"),
		update: (payload: ProfileUpdatePayload) =>
			apiFetch<ProfileUpdateResponse>("/api/profile", {
				method: "PATCH",
				body: JSON.stringify(payload),
			}),
	},
	accounts: {
		list: () => apiFetch<AccountsListResponse>("/api/accounts"),
		create: (data: AccountCreatePayload) =>
			apiFetch<AccountResponse>("/api/accounts", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		update: (id: string, data: AccountUpdatePayload) =>
			apiFetch<AccountResponse>(`/api/accounts?id=${encodeURIComponent(id)}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		delete: (id: string, cascade: boolean) =>
			apiFetch<OkResponse>(
				`/api/accounts?id=${encodeURIComponent(id)}&cascade=${cascade ? "1" : "0"}`,
				{
					method: "DELETE",
				},
			),
		linkedCount: (id: string) =>
			apiFetch<LinkedCountResponse>(
				`/api/accounts?action=linked-count&accountId=${encodeURIComponent(id)}`,
			),
	},
	categories: {
		list: (type?: string) =>
			apiFetch<CategoriesListResponse>(
				`/api/categories${type ? `?type=${encodeURIComponent(type)}` : ""}`,
			),
		create: (data: CategoryPayload) =>
			apiFetch<CategoryResponse>("/api/categories", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		update: (id: string, data: Partial<CategoryPayload>) =>
			apiFetch<CategoryResponse>(
				`/api/categories?id=${encodeURIComponent(id)}`,
				{
					method: "PUT",
					body: JSON.stringify(data),
				},
			),
		delete: (id: string) =>
			apiFetch<OkResponse>(`/api/categories?id=${encodeURIComponent(id)}`, {
				method: "DELETE",
			}),
	},
	transactions: {
		list: (params?: { limit?: number; since?: string }) => {
			const qs = new URLSearchParams();
			if (params?.limit) qs.set("limit", String(params.limit));
			if (params?.since) qs.set("since", params.since);
			const suffix = qs.toString() ? `?${qs.toString()}` : "";
			return apiFetch<TransactionsListResponse>(`/api/transactions${suffix}`);
		},
		create: (data: TransactionCreatePayload) =>
			apiFetch<TransactionResponse>("/api/transactions", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		update: (id: string, data: TransactionUpdatePayload) =>
			apiFetch<TransactionResponse>(
				`/api/transactions?id=${encodeURIComponent(id)}`,
				{
					method: "PUT",
					body: JSON.stringify(data),
				},
			),
		delete: (id: string) =>
			apiFetch<OkResponse>(`/api/transactions?id=${encodeURIComponent(id)}`, {
				method: "DELETE",
			}),
		/** Materialize due recurring occurrences for the current user. */
		processRecurring: () =>
			apiFetch<ProcessRecurringResponse>(
				"/api/transactions?action=process-recurring",
				{ method: "POST" },
			),
	},
	budgets: {
		list: () => apiFetch<BudgetsListResponse>("/api/budgets"),
		create: (data: BudgetPayload) =>
			apiFetch<BudgetResponse>("/api/budgets", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		update: (id: string, data: Partial<BudgetPayload>) =>
			apiFetch<BudgetResponse>(`/api/budgets?id=${encodeURIComponent(id)}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		delete: (id: string) =>
			apiFetch<OkResponse>(`/api/budgets?id=${encodeURIComponent(id)}`, {
				method: "DELETE",
			}),
	},
	goals: {
		list: () => apiFetch<GoalsListResponse>("/api/goals"),
		create: (data: GoalPayload) =>
			apiFetch<GoalResponse>("/api/goals", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		update: (id: string, data: Partial<GoalPayload>) =>
			apiFetch<GoalResponse>(`/api/goals?id=${encodeURIComponent(id)}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		delete: (id: string) =>
			apiFetch<OkResponse>(`/api/goals?id=${encodeURIComponent(id)}`, {
				method: "DELETE",
			}),
	},
	debts: {
		list: () => apiFetch<DebtsListResponse>("/api/debts"),
		create: (data: DebtPayload) =>
			apiFetch<DebtResponse>("/api/debts", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		update: (id: string, data: Partial<DebtPayload>) =>
			apiFetch<DebtResponse>(`/api/debts?id=${encodeURIComponent(id)}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		delete: (id: string) =>
			apiFetch<OkResponse>(`/api/debts?id=${encodeURIComponent(id)}`, {
				method: "DELETE",
			}),
		payments: {
			list: (debtId: string) =>
				apiFetch<DebtPaymentsListResponse>(
					`/api/debts?action=payments&debtId=${encodeURIComponent(debtId)}`,
				),
			create: (data: DebtPaymentPayload) =>
				apiFetch<DebtPaymentResponse>("/api/debts?action=payments", {
					method: "POST",
					body: JSON.stringify(data),
				}),
		},
	},
	ai: {
		insights: {
			list: () => apiFetch<AiInsightsResponse>("/api/ai/insights"),
			generate: (forceRefresh: boolean) =>
				apiFetch<AiInsightsResponse>("/api/ai/insights", {
					method: "POST",
					body: JSON.stringify({ forceRefresh }),
				}),
			dismiss: (id: string) =>
				apiFetch<OkResponse>(`/api/ai/insights?id=${encodeURIComponent(id)}`, {
					method: "PATCH",
				}),
		},
		chat: (
			message: string,
			aiPreferences?: {
				aiProvider?: string;
				kilocodeModel?: string;
			},
			history?: Array<{ role: "user" | "assistant"; content: string }>,
		) =>
			apiFetch<AiChatResponse>("/api/ai/chat", {
				method: "POST",
				body: JSON.stringify({ message, aiPreferences, history }),
			}),
		/**
		 * Streaming variant of chat(): the reply arrives as newline-delimited
		 * JSON events over a chunked response, so onDelta fires as tokens are
		 * generated instead of after the full wait. Resolves with the complete
		 * reply text; throws ApiError on any failure (including error events
		 * sent mid-stream). Pass an AbortSignal to cancel.
		 */
		chatStream: async (
			message: string,
			aiPreferences?: {
				aiProvider?: string;
				kilocodeModel?: string;
			},
			history?: Array<{ role: "user" | "assistant"; content: string }>,
			onDelta?: (text: string) => void,
			signal?: AbortSignal,
		): Promise<string> => {
			// Default 60s timeout so a hung upstream (or the server's own
			// 60s maxDuration) doesn't spin forever on the client (M6). Composed
			// with any caller-supplied signal so the Stop button still works.
			const timeoutSignal = AbortSignal.timeout(API_DEFAULT_TIMEOUT_MS);
			const effectiveSignal = signal
				? (AbortSignal.any([signal, timeoutSignal]) as AbortSignal)
				: timeoutSignal;

			let res: Response;
			try {
				res = await fetch("/api/ai/chat", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "text/event-stream",
					},
					body: JSON.stringify({ message, aiPreferences, history }),
					credentials: "include",
					signal: effectiveSignal,
				});
			} catch (error) {
				if (signal?.aborted) {
					throw error;
				}
				if (timeoutSignal.aborted) {
					throw new ApiError(
						"The AI request timed out. Please try again.",
						{ status: 0, code: "TIMEOUT_ERROR" },
					);
				}
				throw new ApiError(
					"Network error — please check your connection and try again.",
					{ status: 0, code: "NETWORK_ERROR" },
				);
			}

			if (!res.ok || !res.body) {
				let message_ = `Request failed (${res.status})`;
				try {
					const data = (await res.json()) as { error?: string };
					if (data?.error) message_ = data.error;
				} catch {
					// no JSON body; keep fallback
				}
				throw new ApiError(message_, { status: res.status });
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let full = "";

			const handleLine = (rawLine: string) => {
				const line = rawLine.trim();
				if (!line) return;
				let evt: { type?: string; text?: unknown; message?: unknown };
				try {
					evt = JSON.parse(line);
				} catch {
					return; // ignore malformed lines
				}
				if (evt.type === "delta" && typeof evt.text === "string") {
					full += evt.text;
					onDelta?.(evt.text);
				} else if (evt.type === "error") {
					throw new ApiError(
						typeof evt.message === "string"
							? evt.message
							: "The AI service is temporarily unavailable. Please try again.",
						{ status: 502 },
					);
				}
			};

			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					let newlineIndex: number;
					while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
						const line = buffer.slice(0, newlineIndex);
						buffer = buffer.slice(newlineIndex + 1);
						handleLine(line);
					}
				}
				handleLine(buffer); // flush any trailing line without newline
			} catch (error) {
				// Release the connection when bailing out mid-stream (error event,
				// abort); the server notices the closed socket and stops generating.
				await reader.cancel().catch(() => {});
				if (signal?.aborted) {
					throw error;
				}
				if (timeoutSignal.aborted) {
					throw new ApiError(
						"The AI request timed out. Please try again.",
						{ status: 0, code: "TIMEOUT_ERROR" },
					);
				}
				throw error;
			} finally {
				reader.releaseLock();
			}

			return full;
		},
		parseTransaction: (
			message: string,
			aiPreferences?: {
				aiProvider?: string;
				kilocodeModel?: string;
			},
		) =>
			apiFetch<AiParseResponse>("/api/ai/parse-transaction", {
				method: "POST",
				body: JSON.stringify({ message, aiPreferences }),
			}),
		digest: {
			get: () => apiFetch<AiDigestResponse>("/api/ai/digest"),
			generate: (options?: {
				period?: "week" | "month" | "year" | "custom";
				days?: number;
				startDate?: string;
				endDate?: string;
			}) =>
				apiFetch<AiDigestResponse>("/api/ai/digest", {
					method: "POST",
					body: options ? JSON.stringify(options) : undefined,
				}),
		},
	},
	notifications: {
		list: () => apiFetch<NotificationData>("/api/notifications"),
		createBudgetAlert: (
			categoryId: string,
			message: string,
			severity: "low" | "medium" | "high",
		) =>
			apiFetch<NotificationActionResponse>("/api/notifications", {
				method: "POST",
				body: JSON.stringify({
					type: "budget_alert",
					data: { categoryId, message, severity },
				}),
			}),
		updatePushSubscription: (subscription: PushSubscription) =>
			apiFetch<NotificationActionResponse>("/api/notifications", {
				method: "POST",
				body: JSON.stringify({
					type: "push_notification",
					data: { subscription },
				}),
			}),
	},
	systemLogs: {
		list: () => apiFetch<SystemLogsResponse>("/api/system-logs"),
	},
};
