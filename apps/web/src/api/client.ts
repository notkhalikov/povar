const BASE_URL = import.meta.env.VITE_BASE_URL;

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = sessionStorage.getItem('jwt')
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  }

  return res.json() as Promise<T>;
}