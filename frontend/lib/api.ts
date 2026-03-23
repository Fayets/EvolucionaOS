const API_PREFIX = "/api"

/** Evento global: sesión inválida o expirada (401 con Bearer enviado). */
export const EVOLUCIONA_AUTH_UNAUTHORIZED = "evoluciona:auth-unauthorized"

/**
 * URL del REST API bajo el mismo origen (nginx en prod, rewrites en `next dev`).
 * Si `path` ya empieza por `/api/`, no se duplica el prefijo.
 */
export function apiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path
  }
  const p = path.startsWith("/") ? path : `/${path}`
  if (p === "/api" || p.startsWith("/api/")) {
    return p
  }
  return `${API_PREFIX}${p}`
}

const TOKEN_KEY = "evoluciona_token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token)
  } else {
    sessionStorage.removeItem(TOKEN_KEY)
  }
}

export type ApiFetchOptions = RequestInit & {
  /**
   * Token JWT explícito (p. ej. `accessToken` del contexto).
   * Evita carreras con sessionStorage justo tras login u hidratación.
   * Si se omite, se usa `getToken()`.
   */
  bearerToken?: string | null
}

/**
 * Wrapper de fetch que inyecta automáticamente el Authorization header
 * y el Content-Type para JSON. Para requests sin body (GET/DELETE), no
 * agrega Content-Type.
 *
 * Si la respuesta es 401 y se envió Bearer, dispara `EVOLUCIONA_AUTH_UNAUTHORIZED`
 * para que la app cierre sesión de forma uniforme.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { bearerToken, ...init } = options
  const token =
    bearerToken !== undefined
      ? bearerToken && String(bearerToken).trim()
        ? String(bearerToken).trim()
        : null
      : getToken()?.trim() || null

  const headers = new Headers(init.headers)

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const res = await fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: "same-origin",
  })

  if (
    typeof window !== "undefined" &&
    res.status === 401 &&
    token
  ) {
    window.dispatchEvent(new CustomEvent(EVOLUCIONA_AUTH_UNAUTHORIZED))
  }

  return res
}
