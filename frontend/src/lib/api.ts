export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      // Required by the API's CSRF guard on state-changing requests
      'X-Requested-With': 'eotm',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = data?.detail
    if (detail && typeof detail === 'object' && 'message' in detail) {
      throw new ApiError(res.status, detail.message, detail.code)
    }
    if (Array.isArray(detail)) {
      // FastAPI validation errors
      throw new ApiError(res.status, detail.map((d: { msg: string }) => d.msg.replace(/^Value error, /, '')).join('. '))
    }
    throw new ApiError(res.status, typeof detail === 'string' ? detail : 'Something went wrong. Please try again.', typeof detail === 'string' ? detail : undefined)
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}
