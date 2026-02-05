type ApiError = { error: string }

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    credentials: 'include',
    ...options,
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiError
    throw new Error(data.error || `Request failed (${res.status})`)
  }

  return (await res.json()) as T
}

export const api = {
  auth: {
    me: () => apiFetch<{ user: unknown }>('/api/auth/me'),
    login: (email: string, password: string) =>
      apiFetch<{ user: unknown }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    signup: (email: string, password: string, fullName: string) =>
      apiFetch<{ user: unknown }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName }),
      }),
    logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  },
  profile: {
    get: () => apiFetch<{ preferences: unknown; currency: string | null }>('/api/profile'),
    update: (payload: {
      preferences?: Record<string, unknown>
      currency?: string
      full_name?: string
      avatar_url?: string | null
    }) =>
      apiFetch<{ ok: boolean; preferences: unknown; currency: string | null }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
  },
  accounts: {
    list: () => apiFetch<{ accounts: unknown[] }>('/api/accounts'),
    create: (data: Record<string, unknown>) =>
      apiFetch<{ account: unknown }>('/api/accounts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch<{ account: unknown }>(`/api/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string, cascade: boolean) =>
      apiFetch<{ ok: boolean }>(`/api/accounts/${id}?cascade=${cascade ? '1' : '0'}`, {
        method: 'DELETE',
      }),
    linkedCount: (id: string) =>
      apiFetch<{ count: number }>(`/api/accounts/linked-count?accountId=${encodeURIComponent(id)}`),
  },
  categories: {
    list: (type?: string) =>
      apiFetch<{ categories: unknown[] }>(
        `/api/categories${type ? `?type=${encodeURIComponent(type)}` : ''}`,
      ),
    create: (data: Record<string, unknown>) =>
      apiFetch<{ category: unknown }>('/api/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch<{ category: unknown }>(`/api/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/categories/${id}`, { method: 'DELETE' }),
  },
  transactions: {
    list: (params?: { limit?: number; since?: string }) => {
      const qs = new URLSearchParams()
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.since) qs.set('since', params.since)
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      return apiFetch<{ transactions: unknown[] }>(`/api/transactions${suffix}`)
    },
    create: (data: Record<string, unknown>) =>
      apiFetch<{ transaction: unknown }>('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch<{ transaction: unknown }>(`/api/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/transactions/${id}`, { method: 'DELETE' }),
  },
  budgets: {
    list: () => apiFetch<{ budgets: unknown[] }>('/api/budgets'),
    create: (data: Record<string, unknown>) =>
      apiFetch<{ budget: unknown }>('/api/budgets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch<{ budget: unknown }>(`/api/budgets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/budgets/${id}`, { method: 'DELETE' }),
  },
  goals: {
    list: () => apiFetch<{ goals: unknown[] }>('/api/goals'),
    create: (data: Record<string, unknown>) =>
      apiFetch<{ goal: unknown }>('/api/goals', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch<{ goal: unknown }>(`/api/goals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => apiFetch<{ ok: boolean }>(`/api/goals/${id}`, { method: 'DELETE' }),
  },
  debts: {
    list: () => apiFetch<{ debts: unknown[] }>('/api/debts'),
    create: (data: Record<string, unknown>) =>
      apiFetch<{ debt: unknown }>('/api/debts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch<{ debt: unknown }>(`/api/debts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => apiFetch<{ ok: boolean }>(`/api/debts/${id}`, { method: 'DELETE' }),
    payments: {
      list: (debtId: string) =>
        apiFetch<{ payments: unknown[] }>(`/api/debt-payments?debtId=${encodeURIComponent(debtId)}`),
      create: (data: Record<string, unknown>) =>
        apiFetch<{ payment: unknown }>('/api/debt-payments', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
    },
  },
  ai: {
    insights: {
      list: () => apiFetch<{ insights: unknown[] }>('/api/ai/insights'),
      generate: (forceRefresh: boolean) =>
        apiFetch<{ insights: unknown[] }>('/api/ai/insights', {
          method: 'POST',
          body: JSON.stringify({ forceRefresh }),
        }),
      dismiss: (id: string) =>
        apiFetch<{ ok: boolean }>(`/api/ai/insights/${id}`, { method: 'PATCH' }),
    },
    chat: (message: string) =>
      apiFetch<{ response: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
  },
}
