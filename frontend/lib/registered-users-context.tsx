"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { apiFetch } from "@/lib/api"
import { useApp } from "@/lib/app-context"

export type RegisteredUser = {
  id: string
  username: string
  createdAt: string
  /** Fase del cliente en BD; null si no hay ficha Client */
  clientPhase: string | null
}

const STORAGE_KEY = "evoluciona_registered_users"

function loadFromStorage(): RegisteredUser[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
      .map(x => {
        const username = typeof x.username === "string" ? x.username : ""
        if (!username) return null
        return {
          id: String(x.id ?? username),
          username,
          createdAt:
            typeof x.createdAt === "string" ? x.createdAt : new Date().toISOString(),
          clientPhase:
            typeof x.clientPhase === "string" && x.clientPhase.trim() !== ""
              ? x.clientPhase
              : null,
        } satisfies RegisteredUser
      })
      .filter((x): x is RegisteredUser => x !== null)
  } catch {
    return []
  }
}

function saveToStorage(users: RegisteredUser[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
  } catch {
    // ignore
  }
}

type ApiUserRow = {
  id?: number | string
  email?: string
  created_at?: string | null
  client_phase?: string | null
}

function mapApiUsersToRegistered(rows: unknown[]): RegisteredUser[] {
  return rows
    .map((row): RegisteredUser | null => {
      if (!row || typeof row !== "object") return null
      const u = row as ApiUserRow
      const email = u.email
      if (!email) return null
      const id = u.id != null ? String(u.id) : email
      const createdAt =
        u.created_at != null && u.created_at !== ""
          ? new Date(u.created_at as string).toISOString()
          : new Date().toISOString()
      const clientPhase =
        typeof u.client_phase === "string" && u.client_phase.trim() !== ""
          ? u.client_phase
          : null
      return { id, username: email, createdAt, clientPhase }
    })
    .filter((x): x is RegisteredUser => x !== null)
}

type RegisteredUsersContextValue = {
  users: RegisteredUser[]
  /** Carga clientes desde el backend (fuente de verdad). */
  refreshFromServer: () => Promise<boolean>
  /** Tras registrar en API, refresca el listado. */
  registerUser: (username: string, password: string) => { ok: true } | { ok: false; error: string }
  removeUser: (id: string) => void
  /** true mientras el primer fetch está en curso */
  listLoading: boolean
  /** true si el último intento de cargar desde el servidor falló (401, red, etc.) */
  listFetchFailed: boolean
}

const RegisteredUsersContext = createContext<RegisteredUsersContextValue | undefined>(
  undefined
)

export function RegisteredUsersProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useApp()
  const [users, setUsers] = useState<RegisteredUser[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listFetchFailed, setListFetchFailed] = useState(false)

  const refreshFromServer = useCallback(async (): Promise<boolean> => {
    const token = accessToken?.trim()
    if (!token) {
      setListFetchFailed(false)
      setUsers(loadFromStorage())
      return false
    }
    try {
      const params = new URLSearchParams({
        role: "CLIENTE",
        page: "1",
        count: "100",
        sort: "created_at",
        order: "desc",
      })
      const res = await apiFetch(`/users?${params.toString()}`, {
        bearerToken: token,
      })
      if (!res.ok) {
        setListFetchFailed(true)
        return false
      }
      const data = (await res.json()) as { users?: unknown[] }
      const rows = Array.isArray(data.users) ? data.users : []
      const next = mapApiUsersToRegistered(rows)
      setUsers(next)
      saveToStorage(next)
      setListFetchFailed(false)
      return true
    } catch {
      setListFetchFailed(true)
      return false
    }
  }, [accessToken])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!accessToken?.trim()) {
        setListLoading(false)
        setUsers(loadFromStorage())
        setListFetchFailed(false)
        return
      }
      setListLoading(true)
      const ok = await refreshFromServer()
      if (!cancelled && !ok) {
        setUsers(loadFromStorage())
      }
      if (!cancelled) setListLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken, refreshFromServer])

  const registerUser = useCallback(
    (username: string, password: string) => {
      const u = username.trim()
      const p = password
      if (!u || !p) {
        return { ok: false as const, error: "Completá usuario y contraseña." }
      }
      void refreshFromServer()
      return { ok: true as const }
    },
    [refreshFromServer]
  )

  const removeUser = useCallback((id: string) => {
    setUsers(prev => {
      const next = prev.filter(x => x.id !== id)
      saveToStorage(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      users,
      refreshFromServer,
      registerUser,
      removeUser,
      listLoading,
      listFetchFailed,
    }),
    [users, refreshFromServer, registerUser, removeUser, listLoading, listFetchFailed]
  )

  return (
    <RegisteredUsersContext.Provider value={value}>
      {children}
    </RegisteredUsersContext.Provider>
  )
}

export function useRegisteredUsers() {
  const ctx = useContext(RegisteredUsersContext)
  if (!ctx) {
    throw new Error("useRegisteredUsers must be used within RegisteredUsersProvider")
  }
  return ctx
}
