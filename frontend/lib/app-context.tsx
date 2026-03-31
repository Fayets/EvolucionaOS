"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react"
import {
  EVOLUCIONA_AUTH_UNAUTHORIZED,
  apiFetch,
  setToken as persistToken,
} from "@/lib/api"

export type UserRole = "client" | "director" | null
export type ClientPhase = string

const SESSION_KEY = "evoluciona_session"

interface SessionData {
  isLoggedIn: boolean
  userRole: UserRole
  clientPhase: ClientPhase
  userEmail: string
  accessToken: string
}

function loadSession(): SessionData | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionData
  } catch {
    return null
  }
}

function saveSession(data: SessionData | null) {
  if (typeof window === "undefined") return
  if (data) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } else {
    sessionStorage.removeItem(SESSION_KEY)
  }
}

interface AppState {
  isLoggedIn: boolean
  userRole: UserRole
  clientPhase: ClientPhase
  userEmail: string
  accessToken: string
  setIsLoggedIn: (value: boolean) => void
  setUserRole: (role: UserRole) => void
  setClientPhase: (phase: ClientPhase) => void
  setUserEmail: (email: string) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

const AppContext = createContext<AppState | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>(null)
  const [clientPhase, setClientPhase] = useState<ClientPhase>("initial")
  const [userEmail, setUserEmail] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const session = loadSession()
    if (session && session.isLoggedIn && session.accessToken) {
      setIsLoggedIn(session.isLoggedIn)
      setUserRole(session.userRole)
      setClientPhase(session.clientPhase)
      setUserEmail(session.userEmail)
      setAccessToken(session.accessToken)
      persistToken(session.accessToken)
    }
    setHydrated(true)
  }, [])

  /** SessionStorage del Bearer antes del paint y antes de useEffect hijos (evita 401 por carrera). */
  useLayoutEffect(() => {
    if (!hydrated) return
    persistToken(isLoggedIn && accessToken ? accessToken : null)
  }, [hydrated, isLoggedIn, accessToken])

  useEffect(() => {
    if (!hydrated) return
    if (isLoggedIn && accessToken) {
      saveSession({ isLoggedIn, userRole, clientPhase, userEmail, accessToken })
    } else {
      saveSession(null)
    }
  }, [hydrated, isLoggedIn, userRole, clientPhase, userEmail, accessToken])

  // Al refrescar, sincroniza fase real desde backend para clientes.
  useEffect(() => {
    if (!hydrated || !isLoggedIn || userRole !== "client" || !accessToken) return
    const syncClientPhase = async () => {
      try {
        const res = await apiFetch("/users/me/client-phase", { bearerToken: accessToken })
        if (!res.ok) return
        const data = (await res.json()) as { phase?: string }
        if (typeof data.phase === "string" && data.phase && data.phase !== clientPhase) {
          setClientPhase(data.phase)
        }
      } catch {
        // ignore network errors; UI conserva el estado local
      }
    }
    void syncClientPhase()
  }, [hydrated, isLoggedIn, userRole, accessToken, clientPhase])

  const logout = useCallback(() => {
    setIsLoggedIn(false)
    setUserRole(null)
    setClientPhase("initial")
    setUserEmail("")
    setAccessToken("")
    saveSession(null)
    persistToken(null)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onUnauthorized = () => logout()
    window.addEventListener(EVOLUCIONA_AUTH_UNAUTHORIZED, onUnauthorized)
    return () =>
      window.removeEventListener(EVOLUCIONA_AUTH_UNAUTHORIZED, onUnauthorized)
  }, [logout])

  if (!hydrated) {
    return null
  }

  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        userRole,
        clientPhase,
        userEmail,
        accessToken,
        setIsLoggedIn,
        setUserRole,
        setClientPhase,
        setUserEmail,
        setAccessToken,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return context
}
