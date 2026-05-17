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
  NotificationData,
  NotificationActionResponse,
  OkResponse,
} from "@/types";

type ApiError = { error: string };

let authToken: string | null = null;

export function setApiAuthToken(token: string | null) {
  authToken = token;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return (await res.json()) as T;
}

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
      apiFetch<OkResponse>("/api/auth?action=delete-account", { method: "DELETE" }),
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
        geminiApiKey?: string;
        geminiModel?: string;
        openrouterApiKey?: string;
        openrouterModel?: string;
      },
    ) =>
      apiFetch<AiChatResponse>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message, aiPreferences }),
      }),
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
};
