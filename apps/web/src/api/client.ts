const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

function getToken(): string | null {
  return sessionStorage.getItem('jwt')
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Request failed')
  }

  return res.json() as Promise<T>
}
