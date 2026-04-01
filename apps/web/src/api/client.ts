const BASE_URL = import.meta.env.VITE_BASE_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = sessionStorage.getItem('jwt')

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers || {}),
      },
    })
  } catch {
    throw new ApiError('Нет соединения с сервером', 0, 'NETWORK_ERROR')
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    let code: string | undefined
    try {
      const body = await res.json() as { error?: string; code?: string }
      if (body.error) message = body.error
      if (body.code) code = body.code
    } catch { /* ignore parse errors */ }
    throw new ApiError(message, res.status, code)
  }

  return res.json() as Promise<T>
}