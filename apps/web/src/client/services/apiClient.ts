export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
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
export const apiPut = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
export const apiPatch = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
export const apiDelete = <T>(path: string, body: unknown) => request<T>(path, { method: 'DELETE', body: JSON.stringify(body) })
