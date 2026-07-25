const defaultApiBaseUrl =
  typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:5038`
    : 'http://localhost:5038'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new Error('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.')
  }

  if (!response.ok) {
    let message = `خطای سرور (${response.status})`
    try {
      const body = await response.json() as { error?: string; title?: string }
      message = body.error || body.title || message
    } catch { /* A non-JSON response keeps the status message. */ }
    throw new ApiError(message, response.status)
  }

  return response.json() as Promise<T>
}

export const apiGet = <T>(path: string) => request<T>(path)
export const apiPost = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })
