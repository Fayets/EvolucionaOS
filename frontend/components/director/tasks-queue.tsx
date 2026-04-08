"use client"

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ClipboardList, Calendar } from "lucide-react"
import { ACTIVATION_TASKS_CHANGED } from "@/lib/use-activation-tasks-sse"
import { apiFetch } from "@/lib/api"
import { useRegisteredUsers } from "@/lib/registered-users-context"

interface DirectorTask {
  id: string
  clientName: string
  clientEmail: string
  description: string
  requestedNextPhase: string | null
  completed: boolean
  isNew: boolean
  createdAt: string | null
}

function mapTask(raw: {
  id: number
  clientName: string
  clientEmail: string
  description: string
  requestedNextPhase?: string | null
  completed: boolean
  isNew: boolean
  created_at?: string | null
}): DirectorTask {
  return {
    id: String(raw.id),
    clientName: raw.clientName,
    clientEmail: raw.clientEmail,
    description: raw.description,
    requestedNextPhase:
      typeof raw.requestedNextPhase === "string" ? raw.requestedNextPhase : null,
    completed: raw.completed,
    isNew: raw.isNew,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : null,
  }
}

function sortTasksNewestFirst(a: DirectorTask, b: DirectorTask): number {
  const ta = a.createdAt ? Date.parse(a.createdAt) : Number.NaN
  const tb = b.createdAt ? Date.parse(b.createdAt) : Number.NaN
  if (!Number.isNaN(ta) && !Number.isNaN(tb)) return tb - ta
  return Number(b.id) - Number(a.id)
}

function initialsForClient(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  const local = email.split("@")[0] ?? "?"
  return local.slice(0, 2).toUpperCase()
}

function isCreatedToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

const summaryCardClass =
  "flex items-center justify-between gap-4 rounded-xl border border-violet-500/25 bg-zinc-950/90 px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"

const summaryIconBoxClass =
  "flex size-12 shrink-0 items-center justify-center rounded-xl border border-violet-500/35 bg-violet-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"

/** Panel de listas: mismo lenguaje oscuro que las tarjetas naranjas, sin marco blanco */
const listPanelClass =
  "rounded-xl border border-zinc-800/80 bg-zinc-950/90 text-zinc-100 min-h-[280px] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.35)]"

/** ~5 filas visibles; el resto con scroll (pendientes / completadas: filas altas) */
const pendingScrollAreaClass =
  "min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] max-h-[min(31rem,55vh)]"

/** ~5 filas visibles; tarjetas de cliente más compactas */
const clientsScrollAreaClass =
  "min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] max-h-[min(17.5rem,40vh)]"

export function TasksQueue() {
  const [tasks, setTasks] = useState<DirectorTask[]>([])
  const [loading, setLoading] = useState(true)
  const { users } = useRegisteredUsers()

  const usersEnteredToday = useMemo(
    () => users.filter(u => isCreatedToday(u.createdAt)),
    [users]
  )

  const fetchTasks = useCallback(async () => {
    try {
      const res = await apiFetch("/activation-tasks/all")
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data.tasks) ? data.tasks : []
      setTasks(list.map(mapTask).sort(sortTasksNewestFirst))
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    const onChanged = () => fetchTasks()
    const onFocus = () => fetchTasks()
    const interval = setInterval(() => fetchTasks(), 8000)
    window.addEventListener(ACTIVATION_TASKS_CHANGED, onChanged)
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener(ACTIVATION_TASKS_CHANGED, onChanged)
      window.removeEventListener("focus", onFocus)
    }
  }, [fetchTasks])

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const newCompleted = !task.completed
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId ? { ...t, completed: newCompleted, isNew: false } : t
      )
    )
    try {
      const res = await apiFetch(`/activation-tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          completed: newCompleted,
          is_new: false,
        }),
      })
      if (!res.ok) fetchTasks()
    } catch {
      fetchTasks()
    }
  }

  const [clearing, setClearing] = useState(false)

  const clearCompleted = async () => {
    setClearing(true)
    try {
      const res = await apiFetch("/activation-tasks/completed", { method: "DELETE" })
      if (res.ok) {
        setTasks(prev => prev.filter(t => !t.completed))
      }
    } catch {
      /* ignore */
    } finally {
      setClearing(false)
    }
  }

  const pendingTasks = tasks.filter(t => !t.completed)

  /** Un renglón por cliente con tareas pendientes: "Nombre (N)" */
  const clientsPendingSummary = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    for (const t of pendingTasks) {
      const cur = map.get(t.clientEmail)
      if (cur) cur.count += 1
      else map.set(t.clientEmail, { name: t.clientName, count: 1 })
    }
    return Array.from(map.entries())
      .map(([email, v]) => ({ email, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
  }, [pendingTasks])

  const completedTasks = tasks.filter(t => t.completed)

  const cardShell = (children: ReactNode, title: string, headerAction?: ReactNode) => (
    <div className="relative w-full">
      <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/25 via-fuchsia-500/25 to-purple-500/25 blur-2xl opacity-40" />
      <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
        <CardHeader className="pb-2 border-b border-zinc-800 px-6 md:px-8">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
              {title}
            </p>
            {headerAction}
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-6 md:px-8 pb-6 text-white">{children}</CardContent>
      </Card>
    </div>
  )

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 animate-pulse">
          <div className="h-24 rounded-xl bg-zinc-800/60" />
          <div className="h-24 rounded-xl bg-zinc-800/60" />
          <div className="h-80 rounded-2xl bg-zinc-800/40 xl:col-span-1" />
          <div className="h-80 rounded-2xl bg-zinc-800/40 xl:col-span-1" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-8">
        {/* Columna: tareas pendientes */}
        <div className="flex flex-col gap-4">
          <div className={summaryCardClass}>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Tareas pendientes
              </p>
              <p className="mt-1 bg-gradient-to-br from-violet-300 to-fuchsia-300 bg-clip-text text-4xl font-semibold tabular-nums text-transparent">
                {pendingTasks.length}
              </p>
            </div>
            <div className={summaryIconBoxClass}>
              <ClipboardList className="size-7 text-violet-400" strokeWidth={1.75} aria-hidden />
            </div>
          </div>

          <div className={`${listPanelClass} overflow-hidden`}>
              <div
                className={`flex flex-col divide-y divide-zinc-800/80 ${pendingScrollAreaClass}`}
              >
                {pendingTasks.map(task => (
                  <div key={task.id} className="flex items-start gap-4 px-4 py-4 first:pt-4">
                    <Checkbox
                      id={task.id}
                      checked={task.completed}
                      onCheckedChange={() => toggleTask(task.id)}
                      className="mt-1 border-zinc-500 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-medium text-white">{task.clientName}</span>
                        {task.isNew && (
                          <span className="size-2 shrink-0 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        )}
                      </div>
                      <p className="mb-1 text-sm text-zinc-300">{task.description}</p>
                      {task.requestedNextPhase && (
                        <p className="mb-1 text-xs font-medium text-amber-200/90">
                          Al marcar como hecha, el alumno pasa a: «{task.requestedNextPhase}»
                        </p>
                      )}
                      <p className="text-xs text-zinc-500">{task.clientEmail}</p>
                    </div>
                  </div>
                ))}
                {pendingTasks.length === 0 && (
                  <p className="py-12 text-center text-sm text-zinc-500">
                    No hay tareas pendientes
                  </p>
                )}
              </div>
          </div>
        </div>

        {/* Columna: ingresaron hoy + panel (misma caja que la columna de tareas) */}
        <div className="flex flex-col gap-4">
          <div className={summaryCardClass}>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Ingresaron hoy
              </p>
              <p className="mt-1 bg-gradient-to-br from-violet-300 to-fuchsia-300 bg-clip-text text-4xl font-semibold tabular-nums text-transparent">
                {usersEnteredToday.length}
              </p>
            </div>
            <div className={summaryIconBoxClass}>
              <Calendar className="size-7 text-violet-400" strokeWidth={1.75} aria-hidden />
            </div>
          </div>

          <div className={`${listPanelClass} overflow-hidden`}>
            <div className={`space-y-2 p-3 ${clientsScrollAreaClass}`}>
              {clientsPendingSummary.map(c => (
                <div
                  key={c.email}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800/90 bg-black/35 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,background-color] duration-150 hover:border-violet-500/30 hover:bg-zinc-900/60"
                >
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-md"
                    style={{
                      background:
                        "linear-gradient(145deg, rgba(124, 58, 237, 0.95), rgba(192, 132, 252, 0.75))",
                    }}
                  >
                    {initialsForClient(c.name, c.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium leading-tight text-zinc-100">
                      {c.name}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">{c.email}</p>
                  </div>
                  <span
                    className="flex h-8 min-w-[2.25rem] shrink-0 items-center justify-center rounded-full border border-violet-500/35 bg-violet-500/[0.12] px-2 text-sm font-semibold tabular-nums text-violet-200 shadow-[0_0_12px_-4px_rgba(139,92,246,0.5)]"
                    title="Notificaciones pendientes"
                  >
                    {c.count}
                  </span>
                </div>
              ))}
              {clientsPendingSummary.length === 0 && (
                <p className="py-12 text-center text-sm text-zinc-500">
                  Sin notificaciones pendientes por cliente.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {completedTasks.length > 0 && (
        <div className="mt-2">
          {cardShell(
            <div className="flex flex-col">
              <div
                className={`flex flex-col divide-y divide-zinc-800 ${pendingScrollAreaClass}`}
              >
                {completedTasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-start gap-4 py-4 first:pt-0 opacity-70"
                  >
                    <Checkbox
                      id={`done-${task.id}`}
                      checked={task.completed}
                      onCheckedChange={() => toggleTask(task.id)}
                      className="mt-1 border-zinc-500 data-[state=checked]:bg-zinc-600 data-[state=checked]:border-zinc-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-medium text-zinc-400 line-through">
                          {task.clientName}
                        </span>
                      </div>
                      <p className="mb-1 line-through text-sm text-zinc-500">{task.description}</p>
                      <p className="text-xs text-zinc-600">{task.clientEmail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>,
            `Completadas (${completedTasks.length})`,
            <button
              type="button"
              onClick={clearCompleted}
              disabled={clearing}
              title="Limpiar completadas"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:opacity-40"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
