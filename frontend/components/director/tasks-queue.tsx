"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ACTIVATION_TASKS_CHANGED } from "@/lib/use-activation-tasks-sse"
import { apiFetch } from "@/lib/api"

interface DirectorTask {
  id: string
  clientName: string
  clientEmail: string
  description: string
  requestedNextPhase: string | null
  completed: boolean
  isNew: boolean
}

function mapTask(raw: {
  id: number
  clientName: string
  clientEmail: string
  description: string
  requestedNextPhase?: string | null
  completed: boolean
  isNew: boolean
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
  }
}

export function TasksQueue() {
  const [tasks, setTasks] = useState<DirectorTask[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await apiFetch("/activation-tasks/all")
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data.tasks) ? data.tasks : []
      setTasks(list.map(mapTask))
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
    window.addEventListener(ACTIVATION_TASKS_CHANGED, onChanged)
    window.addEventListener("focus", onFocus)
    return () => {
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
        t.id === taskId
          ? { ...t, completed: newCompleted, isNew: false }
          : t
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

  const [completedPage, setCompletedPage] = useState(0)
  const [clearing, setClearing] = useState(false)
  const COMPLETED_PAGE_SIZE = 5

  const clearCompleted = async () => {
    setClearing(true)
    try {
      const res = await apiFetch("/activation-tasks/completed", { method: "DELETE" })
      if (res.ok) {
        setTasks(prev => prev.filter(t => !t.completed))
        setCompletedPage(0)
      }
    } catch { /* ignore */ } finally {
      setClearing(false)
    }
  }

  const newTasksCount = tasks.filter(t => t.isNew).length
  const pendingTasks = tasks.filter(t => !t.completed)
  const completedTasks = tasks.filter(t => t.completed)
  const totalCompletedPages = Math.max(1, Math.ceil(completedTasks.length / COMPLETED_PAGE_SIZE))
  const paginatedCompleted = completedTasks.slice(
    completedPage * COMPLETED_PAGE_SIZE,
    (completedPage + 1) * COMPLETED_PAGE_SIZE
  )

  const cardShell = (
    children: ReactNode,
    title: string,
    headerAction?: ReactNode
  ) => (
    <div className="relative w-full">
      <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/40 via-fuchsia-500/40 to-purple-500/40 blur-2xl opacity-50" />
      <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
        <CardHeader className="pb-2 border-b border-zinc-800 px-6 md:px-8">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
              {title}
            </p>
            {headerAction}
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-6 md:px-8 pb-6 text-white">
          {children}
        </CardContent>
      </Card>
    </div>
  )

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto flex items-center justify-center py-12">
        <p className="text-zinc-500">Cargando tareas...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Título + badge en línea con estilo oscuro */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-white">
          Tareas de activación
        </h1>
        {newTasksCount > 0 && (
          <Badge
            className="h-8 px-4 text-sm rounded-full border border-purple-500/50 bg-zinc-900 text-purple-200 hover:bg-zinc-800"
          >
            {newTasksCount} nueva{newTasksCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {cardShell(
        <div className="flex flex-col divide-y divide-zinc-800">
          {pendingTasks.map(task => (
            <div
              key={task.id}
              className="flex items-start gap-4 py-4 first:pt-0"
            >
              <Checkbox
                id={task.id}
                checked={task.completed}
                onCheckedChange={() => toggleTask(task.id)}
                className="mt-1 border-zinc-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white">
                    {task.clientName}
                  </span>
                  {task.isNew && (
                    <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                  )}
                </div>
                <p className="text-sm text-zinc-200 mb-1">{task.description}</p>
                {task.requestedNextPhase && (
                  <p className="text-xs font-medium text-amber-200/90 mb-1">
                    Al marcar como hecha, el alumno pasa a: «{task.requestedNextPhase}»
                  </p>
                )}
                <p className="text-xs text-zinc-500">{task.clientEmail}</p>
              </div>
            </div>
          ))}
          {pendingTasks.length === 0 && (
            <p className="py-4 text-sm text-zinc-500 text-center">
              No hay tareas pendientes
            </p>
          )}
        </div>,
        `Pendientes (${pendingTasks.length})`
      )}

      {completedTasks.length > 0 && (
        <div className="mt-2">
          {cardShell(
            <div className="flex flex-col">
              <div className="flex flex-col divide-y divide-zinc-800">
                {paginatedCompleted.map(task => (
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-zinc-400 line-through">
                          {task.clientName}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500 line-through mb-1">
                        {task.description}
                      </p>
                      <p className="text-xs text-zinc-600">{task.clientEmail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {totalCompletedPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4 border-t border-zinc-800 mt-2">
                  <button
                    onClick={() => setCompletedPage(p => Math.max(0, p - 1))}
                    disabled={completedPage === 0}
                    className="px-3 py-1 text-xs rounded border border-zinc-700 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-zinc-500">
                    {completedPage + 1} / {totalCompletedPages}
                  </span>
                  <button
                    onClick={() => setCompletedPage(p => Math.min(totalCompletedPages - 1, p + 1))}
                    disabled={completedPage >= totalCompletedPages - 1}
                    className="px-3 py-1 text-xs rounded border border-zinc-700 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>,
            `Completadas (${completedTasks.length})`,
            <button
              onClick={clearCompleted}
              disabled={clearing}
              title="Limpiar completadas"
              className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
