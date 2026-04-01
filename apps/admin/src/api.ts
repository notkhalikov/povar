const BASE = '/api'

function getToken() {
  return localStorage.getItem('admin_jwt') ?? ''
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number
  role: string
  name: string
}

export function authTelegram(initData: string): Promise<{ token: string; user: AuthUser }> {
  return apiFetch('/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  })
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number
  telegramId: number
  name: string
  role: string
  status: string
  city: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  createdAt: string
}

export function getUsers(params: Record<string, string | number> = {}): Promise<{ data: AdminUser[] }> {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return apiFetch(`/admin/users${qs ? `?${qs}` : ''}`)
}

export function patchUserStatus(id: number, status: 'active' | 'banned'): Promise<AdminUser> {
  return apiFetch(`/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface AdminOrder {
  id: number
  status: string
  type: string
  city: string
  district: string | null
  scheduledAt: string
  agreedPrice: string | null
  persons: number
  createdAt: string
  customerName: string
  chefName: string
  customerId: number
  chefId: number
}

export function getOrders(params: Record<string, string | number> = {}): Promise<{ data: AdminOrder[] }> {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return apiFetch(`/admin/orders${qs ? `?${qs}` : ''}`)
}

// ─── Disputes ─────────────────────────────────────────────────────────────────

export interface AdminDispute {
  id: number
  orderId: number
  openedBy: string
  reasonCode: string
  description: string | null
  status: string
  resolutionType: string | null
  resolutionComment: string | null
  createdAt: string
  updatedAt: string
  customerName: string
  chefName: string
  customerId: number
  chefId: number
}

export function getDisputes(params: Record<string, string | number> = {}): Promise<{ data: AdminDispute[] }> {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return apiFetch(`/admin/disputes${qs ? `?${qs}` : ''}`)
}

export function resolveDispute(
  id: number,
  body: { resolutionType: string; resolutionComment?: string },
): Promise<AdminDispute> {
  return apiFetch(`/admin/disputes/${id}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalOrders: number
  totalRevenue: number
  ordersByType: { home_visit: number; delivery: number }
  totalDisputes: number
  openDisputes: number
  approvedChefs: number
  totalUsers: number
  ordersByCity: { city: string; count: number; revenue: number }[]
  ordersByUtm:  { utmSource: string; count: number; revenue: number }[]
  funnel: { registered: number; createdOrder: number; paidOrder: number }
}

export interface StatsFilter {
  from?:      string
  to?:        string
  city?:      string
  utmSource?: string
}

export function getStats(filter: StatsFilter = {}): Promise<AdminStats> {
  const params: Record<string, string> = {}
  if (filter.from)      params.from      = filter.from
  if (filter.to)        params.to        = filter.to
  if (filter.city)      params.city      = filter.city
  if (filter.utmSource) params.utmSource = filter.utmSource
  const qs = new URLSearchParams(params).toString()
  return apiFetch(`/admin/stats${qs ? `?${qs}` : ''}`)
}

export function exportUrl(type: 'orders' | 'users'): string {
  const token = localStorage.getItem('admin_jwt') ?? ''
  return `/api/admin/export/${type}.csv?token=${encodeURIComponent(token)}`
}
