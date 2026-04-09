"use client"

import { useState, useEffect, useCallback } from "react"
import { ClipboardList, ListChecks, Trash2 } from "lucide-react"
import { useApp } from "@/lib/app-context"
import { apiFetch } from "@/lib/api"
import { getNextPhaseOrDone } from "@/lib/phases"
import {
  fetchMyClientPhase,
  fetchPendingPhaseAdvance,
  requestPhaseAdvance,
} from "@/lib/phase-advance"
import { CLIENT_NOTIFICATIONS_CHANGED } from "@/lib/use-client-notifications-sse"
import { ClientLayoutLogo, ClientSidebar } from "@/components/client-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  MandatoryTaskDeliverableBlock,
  type MandatoryDeliverableEntry,
} from "@/components/client/mandatory-task-deliverable-block"

interface TaskFromApi {
  id: number
  slug: string
  label: string
  link_url: string
  deliverable_links?: string[]
  order: number | null
  phase: string
}

interface ParticularTaskFromApi {
  id: number
  phase: string
  label: string
  link_url: string
  completed: boolean
}

interface UserNotification {
  id: number
  title: string
  body: string | null
  read_at: string | null
  created_at: string | null
}

type TaskModalState =
  | { kind: "mandatory"; taskId: number }
  | { kind: "particular"; taskId: number }
  | null

function parseDeliverablesMap(raw: unknown): Record<string, MandatoryDeliverableEntry> {
  if (!raw || typeof raw !== "object") return {}
  const out: Record<string, MandatoryDeliverableEntry> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (
      v &&
      typeof v === "object" &&
      "submitted_at" in v &&
      typeof (v as MandatoryDeliverableEntry).submitted_at === "string"
    ) {
      const e = v as MandatoryDeliverableEntry & Record<string, unknown>
      const row: MandatoryDeliverableEntry = {
        label: String(e.label ?? ""),
        note: String(e.note ?? ""),
        link: String(e.link ?? ""),
        submitted_at: e.submitted_at,
      }
      if (Array.isArray(e.history)) {
        row.history = e.history
          .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
          .map((h) => ({
            note: String(h.note ?? ""),
            link: String(h.link ?? ""),
            submitted_at: String(h.submitted_at ?? ""),
            director_note: typeof h.director_note === "string" ? h.director_note : undefined,
            director_link: typeof h.director_link === "string" ? h.director_link : undefined,
            corrected_at: typeof h.corrected_at === "string" ? h.corrected_at : undefined,
          }))
      }
      if (typeof e.director_note === "string" && e.director_note)
        row.director_note = e.director_note
      if (typeof e.director_link === "string" && e.director_link)
        row.director_link = e.director_link
      if (typeof e.corrected_at === "string" && e.corrected_at)
        row.corrected_at = e.corrected_at
      out[k] = row
    }
  }
  return out
}

export function PhaseTasks({
  phase,
  onBack,
  onGoHome,
  forcePhaseView = false,
}: {
  phase: string
  onBack?: () => void
  onGoHome?: () => void
  forcePhaseView?: boolean
}) {
  const { userEmail, setClientPhase } = useApp()
  const [tasks, setTasks] = useState<TaskFromApi[]>([])
  const [particularTasks, setParticularTasks] = useState<ParticularTaskFromApi[]>([])
  const [completedSlugs, setCompletedSlugs] = useState<Set<string>>(new Set())
  const [awaitingDirector, setAwaitingDirector] = useState(false)
  const [pendingTargetPhase, setPendingTargetPhase] = useState<string | null>(null)
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [deliverables, setDeliverables] = useState<
    Record<string, MandatoryDeliverableEntry>
  >({})
  const [taskModal, setTaskModal] = useState<TaskModalState>(null)

  const fetchDeliverables = useCallback(async () => {
    if (!userEmail) return
    try {
      const res = await apiFetch(
        `/users/mandatory-deliverables?email=${encodeURIComponent(userEmail)}`
      )
      if (res.ok) {
        const data = await res.json()
        setDeliverables(parseDeliverablesMap(data.deliverables))
      }
    } catch {
      /* ignore */
    }
  }, [userEmail])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await apiFetch(`/mandatory-tasks?phase=${encodeURIComponent(phase)}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(Array.isArray(data) ? data : [])
      } else {
        setTasks([])
      }
    } catch {
      setTasks([])
    }
  }, [phase])

  const fetchParticularTasks = useCallback(async () => {
    if (!userEmail) return
    try {
      const res = await apiFetch(
        `/particular-tasks/all?email=${encodeURIComponent(userEmail)}&phase=${encodeURIComponent(phase)}`
      )
      if (res.ok) {
        const data = await res.json()
        setParticularTasks(Array.isArray(data.tasks) ? data.tasks : [])
      } else {
        setParticularTasks([])
      }
    } catch {
      setParticularTasks([])
    }
  }, [userEmail, phase])

  const fetchCompletion = useCallback(async () => {
    if (!userEmail) return
    try {
      const res = await apiFetch(
        `/mandatory-tasks-completion?email=${encodeURIComponent(userEmail)}&phase=${encodeURIComponent(phase)}`
      )
      if (res.ok) {
        const data = await res.json()
        setCompletedSlugs(new Set(data.completed_slugs || []))
      }
    } catch {
      /* ignore */
    }
  }, [userEmail, phase])

  const fetchNotifications = useCallback(async () => {
    if (!userEmail) return
    try {
      const res = await apiFetch(`/notifications/all?email=${encodeURIComponent(userEmail)}`)
      if (res.ok) {
        const data = await res.json()
        setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      } else {
        setNotifications([])
      }
    } catch {
      setNotifications([])
    }
  }, [userEmail])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      if (userEmail) {
        const pending = await fetchPendingPhaseAdvance(userEmail)
        if (pending.pending && pending.targetPhase) {
          setAwaitingDirector(true)
          setPendingTargetPhase(pending.targetPhase)
        } else {
          setAwaitingDirector(false)
          setPendingTargetPhase(null)
        }
      }
      await fetchTasks()
      await fetchCompletion()
      await fetchParticularTasks()
      await fetchNotifications()
      await fetchDeliverables()
      setLoading(false)
    }
    load()
  }, [userEmail, fetchTasks, fetchCompletion, fetchParticularTasks, fetchNotifications, fetchDeliverables])

  useEffect(() => {
    const refreshTasks = () => {
      fetchTasks()
      fetchCompletion()
      fetchParticularTasks()
      fetchNotifications()
      void fetchDeliverables()
    }
    window.addEventListener(CLIENT_NOTIFICATIONS_CHANGED, refreshTasks)
    return () => window.removeEventListener(CLIENT_NOTIFICATIONS_CHANGED, refreshTasks)
  }, [fetchTasks, fetchCompletion, fetchParticularTasks, fetchNotifications, fetchDeliverables])

  const toggleMandatoryTask = async (slug: string) => {
    const newCompleted = !completedSlugs.has(slug)
    setCompletedSlugs(prev => {
      const next = new Set(prev)
      if (newCompleted) next.add(slug)
      else next.delete(slug)
      return next
    })
    if (!userEmail) return
    try {
      await apiFetch("/mandatory-tasks-complete", {
        method: "POST",
        body: JSON.stringify({ email: userEmail, task_slug: slug, completed: newCompleted }),
      })
    } catch {
      setCompletedSlugs(prev => {
        const next = new Set(prev)
        if (newCompleted) next.delete(slug)
        else next.add(slug)
        return next
      })
    }
  }

  const toggleParticularTask = async (taskId: number) => {
    const task = particularTasks.find(t => t.id === taskId)
    if (!task || !userEmail) return
    const newCompleted = !task.completed
    setParticularTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, completed: newCompleted } : t))
    )
    try {
      const res = await apiFetch(`/particular-tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ email: userEmail, completed: newCompleted }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setParticularTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, completed: !newCompleted } : t))
      )
    }
  }

  const deleteNotification = async (notificationId: number) => {
    if (!userEmail) return
    const previous = notifications
    setNotifications((current) => current.filter((n) => n.id !== notificationId))
    try {
      const res = await apiFetch(
        `/notifications/${notificationId}?email=${encodeURIComponent(userEmail)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error()
    } catch {
      setNotifications(previous)
    }
  }

  const deleteAllNotifications = async () => {
    if (!userEmail || accessNotifications.length === 0) return
    const previous = notifications
    setNotifications([])
    try {
      const res = await apiFetch(`/notifications/all?email=${encodeURIComponent(userEmail)}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
    } catch {
      setNotifications(previous)
    }
  }

  const allMandatoryCompleted = tasks.length === 0 || tasks.every(t => completedSlugs.has(t.slug))
  const allParticularCompleted = particularTasks.every(t => t.completed)
  const allTasksCompleted = allMandatoryCompleted && allParticularCompleted
  const hasAnyTasks = tasks.length > 0 || particularTasks.length > 0
  const isAccessPhase = phase === "Acceso" && !forcePhaseView
  const accessMandatoryPending = tasks.filter((t) => !completedSlugs.has(t.slug))
  const accessParticularPending = particularTasks.filter((t) => !t.completed)
  const accessParticularCompleted = particularTasks.filter((t) => t.completed)
  const accessNotifications = [
    ...notifications.map((n) => ({
      id: `n-${n.id}`,
      notificationId: n.id,
      label: n.title,
      body: n.body,
      state: n.read_at ? "Completada" as const : "Pendiente" as const,
    })),
  ]

  const [finishing, setFinishing] = useState(false)

  const nextPhase = getNextPhaseOrDone(phase)

  const trySyncApprovedPhase = useCallback(async () => {
    if (!pendingTargetPhase || !userEmail) return
    const serverPhase = await fetchMyClientPhase()
    if (serverPhase && serverPhase === pendingTargetPhase) {
      setClientPhase(serverPhase)
      setAwaitingDirector(false)
      setPendingTargetPhase(null)
    }
  }, [pendingTargetPhase, userEmail, setClientPhase])

  useEffect(() => {
    if (!awaitingDirector || !pendingTargetPhase) return
    void trySyncApprovedPhase()
    window.addEventListener("focus", trySyncApprovedPhase)
    const onNotify = () => void trySyncApprovedPhase()
    window.addEventListener(CLIENT_NOTIFICATIONS_CHANGED, onNotify)
    const interval = setInterval(() => void trySyncApprovedPhase(), 20000)
    return () => {
      window.removeEventListener("focus", trySyncApprovedPhase)
      window.removeEventListener(CLIENT_NOTIFICATIONS_CHANGED, onNotify)
      clearInterval(interval)
    }
  }, [awaitingDirector, pendingTargetPhase, trySyncApprovedPhase])

  const handleFinishPhase = async () => {
    if (!userEmail) return
    const target = nextPhase
    if (!target) return
    setAdvanceError(null)
    setFinishing(true)
    try {
      const { ok, message } = await requestPhaseAdvance(userEmail, target)
      if (ok) {
        setAwaitingDirector(true)
        setPendingTargetPhase(target)
      } else {
        setAdvanceError(message)
      }
    } finally {
      setFinishing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent text-white flex flex-col items-center">
        <ClientLayoutLogo />
        <div className="flex w-full flex-1">
          <ClientSidebar
            primaryNavLabel="Inicio"
            secondNavLabel="Fases"
            activeNav={forcePhaseView ? "secondary" : "primary"}
            onPrimaryNavClick={forcePhaseView ? onGoHome : undefined}
            onSecondNavClick={!forcePhaseView ? onBack : undefined}
          />
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-zinc-500">Cargando tareas...</p>
          </div>
        </div>
      </div>
    )
  }

  if (awaitingDirector && pendingTargetPhase) {
    return (
      <div className="min-h-screen bg-transparent text-white flex flex-col items-center">
        <ClientLayoutLogo />
        <div className="flex w-full flex-1">
          <ClientSidebar
            primaryNavLabel="Inicio"
            secondNavLabel="Fases"
            activeNav={forcePhaseView ? "secondary" : "primary"}
            onPrimaryNavClick={forcePhaseView ? onGoHome : undefined}
            onSecondNavClick={!forcePhaseView ? onBack : undefined}
          />
          <div className="flex-1 flex flex-col items-center justify-start px-4 pt-10 pb-10">
            <div className="relative w-full max-w-xl">
            <div className="pointer-events-none absolute -inset-[1px] rounded-2xl border border-violet-400/10" />
              <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
                <CardContent className="pt-8 pb-8 px-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">
                    Esperando aprobación del director
                  </h2>
                  <p className="text-sm text-zinc-300 mb-6">
                    {pendingTargetPhase === "done"
                      ? "Solicitaste cerrar el programa. Cuando tu director apruebe, vas a ver la pantalla final aquí."
                      : `Solicitaste pasar a la fase «${pendingTargetPhase}». Cuando sea aprobado, vas a continuar automáticamente.`}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border border-zinc-600 bg-zinc-900/90 px-8 py-2.5 text-sm font-semibold tracking-wide text-white hover:bg-zinc-800 hover:border-zinc-400 hover:text-white"
                    onClick={() => void trySyncApprovedPhase()}
                  >
                    ACTUALIZAR
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isAccessPhase) {
    return (
      <div className="min-h-screen bg-transparent text-white flex flex-col items-center">
        <ClientLayoutLogo />
        <div className="flex w-full flex-1">
          <ClientSidebar
            primaryNavLabel="Inicio"
            secondNavLabel="Fases"
            activeNav={forcePhaseView ? "secondary" : "primary"}
            onPrimaryNavClick={forcePhaseView ? onGoHome : undefined}
            onSecondNavClick={!forcePhaseView ? onBack : undefined}
          />
          <div className="flex-1 flex flex-col items-center justify-start px-4 pt-10 pb-10">
            <div className="w-full max-w-6xl">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                    <p className="text-sm font-semibold text-zinc-100">Notificaciones</p>
                    <button
                      type="button"
                      onClick={() => void deleteAllNotifications()}
                      disabled={accessNotifications.length === 0}
                      title="Eliminar todas"
                      className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="max-h-[min(32rem,56vh)] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
                    {accessNotifications.length === 0 ? (
                      <p className="px-4 py-10 text-center text-sm text-zinc-500">
                        No hay notificaciones.
                      </p>
                    ) : (
                      <div className="divide-y divide-zinc-800/80">
                        {accessNotifications.map((notification) => (
                          <div key={notification.id} className="flex items-start justify-between gap-3 px-4 py-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-white">{notification.label}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {notification.body || "Notificacion del administrador"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                  notification.state === "Pendiente"
                                    ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
                                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                }`}
                              >
                                {notification.state}
                              </div>
                              <button
                                type="button"
                                onClick={() => void deleteNotification(notification.notificationId)}
                                title="Eliminar notificacion"
                                className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                  <div className="border-b border-zinc-800 px-4 py-3">
                    <p className="text-sm font-semibold text-zinc-100">Tareas pendientes</p>
                  </div>
                  <div className="max-h-[min(32rem,56vh)] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
                    {[...accessMandatoryPending, ...accessParticularPending].length === 0 ? (
                      <p className="px-4 py-10 text-center text-sm text-zinc-500">
                        No hay tareas pendientes.
                      </p>
                    ) : (
                      <div className="divide-y divide-zinc-800/80">
                        {accessMandatoryPending.map((task) => (
                          <div key={`ac-p-m-${task.id}`} className="flex items-start gap-3 px-4 py-4">
                            <Checkbox
                              id={`ac-p-m-${task.slug}`}
                              checked={completedSlugs.has(task.slug)}
                              onCheckedChange={() => toggleMandatoryTask(task.slug)}
                              className="mt-1 size-5 shrink-0 border-zinc-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                            />
                            <div className="min-w-0 flex-1">
                              <Label htmlFor={`ac-p-m-${task.slug}`} className="cursor-pointer text-sm text-white">
                                {task.label}
                              </Label>
                              <p className="mt-1 text-xs text-zinc-500">Tarea pendiente de la fase</p>
                            </div>
                          </div>
                        ))}
                        {accessParticularPending.map((task) => (
                          <div key={`ac-p-p-${task.id}`} className="flex items-start gap-3 px-4 py-4">
                            <Checkbox
                              id={`ac-p-p-${task.id}`}
                              checked={task.completed}
                              onCheckedChange={() => toggleParticularTask(task.id)}
                              className="mt-1 size-5 shrink-0 border-zinc-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                            />
                            <div className="min-w-0 flex-1">
                              <Label htmlFor={`ac-p-p-${task.id}`} className="cursor-pointer text-sm text-white">
                                {task.label}
                              </Label>
                              <p className="mt-1 text-xs text-zinc-500">Notificacion del administrador</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col items-center">
      <ClientLayoutLogo />
      <div className="flex w-full flex-1">
        <ClientSidebar
          primaryNavLabel="Inicio"
          secondNavLabel="Fases"
          activeNav={forcePhaseView ? "secondary" : "primary"}
          onPrimaryNavClick={forcePhaseView ? onGoHome : undefined}
          onSecondNavClick={!forcePhaseView ? onBack : undefined}
        />
        <div className="flex-1 flex flex-col items-center justify-start px-4 pt-10 pb-10">
          <div className="relative w-full max-w-6xl">
            <div className="pointer-events-none absolute -inset-[1px] rounded-2xl border border-violet-400/10" />
            <Card className="relative w-full rounded-2xl border border-zinc-800/90 bg-black/85 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
              <CardHeader className="pb-3 border-b border-zinc-800 px-6 md:px-10 flex items-center">
                <div className="flex w-full items-center justify-between gap-3">
                  {onBack && forcePhaseView ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onBack}
                      className="h-9 rounded-full border-zinc-600 bg-zinc-900/90 px-4 text-xs font-semibold text-white hover:bg-zinc-800 hover:text-white"
                    >
                      VOLVER A FASES
                    </Button>
                  ) : null}
                  <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
                    {phase.toUpperCase()}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="px-6 md:px-10 py-7">
                <div className="space-y-5">
                  {!hasAnyTasks ? (
                    <p className="text-zinc-400 text-sm">No hay tareas configuradas para esta fase.</p>
                  ) : (
                    <div className="space-y-6">
                      {tasks.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Tareas obligatorias
                          </p>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 [contain:layout_paint_style]">
                            {tasks.map(task => (
                              <div
                                key={`m-${task.id}`}
                                onClick={() => setTaskModal({ kind: "mandatory", taskId: task.id })}
                                className="group flex h-full min-h-[190px] cursor-pointer flex-col rounded-2xl border border-zinc-700/90 bg-zinc-900/80 shadow-[0_4px_12px_rgba(0,0,0,0.2)] [contain:paint]"
                                style={{ contentVisibility: "auto", containIntrinsicSize: "190px" }}
                              >
                                <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
                                  <div className="inline-flex items-center gap-2 rounded-full border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-200">
                                    <ClipboardList className="size-3.5 text-violet-300" />
                                    Obligatoria
                                  </div>
                                  <Checkbox
                                    id={`task-${task.slug}`}
                                    checked={completedSlugs.has(task.slug)}
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleMandatoryTask(task.slug)}
                                    className="size-5 shrink-0 border-zinc-500 data-[state=checked]:border-purple-500 data-[state=checked]:bg-purple-500"
                                  />
                                </div>
                                <div className="flex flex-1 flex-col justify-between p-4">
                                  <div className="min-w-0">
                                    <p className="line-clamp-2 text-sm font-semibold uppercase text-white">{task.label}</p>
                                    <p className="mt-1 text-xs text-zinc-400">
                                      Toca para ver links, entregables y correcciones.
                                    </p>
                                  </div>
                                  <p className="mt-4 text-[11px] font-medium text-zinc-500">
                                    Ver detalle
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {particularTasks.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Tareas particulares
                          </p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 [contain:layout_paint_style]">
                            {particularTasks.map(task => (
                              <div
                                key={`p-${task.id}`}
                                onClick={() => setTaskModal({ kind: "particular", taskId: task.id })}
                                className="group flex min-h-[190px] cursor-pointer flex-col rounded-2xl border border-zinc-700/90 bg-zinc-900/80 shadow-[0_4px_12px_rgba(0,0,0,0.2)] [contain:paint]"
                                style={{ contentVisibility: "auto", containIntrinsicSize: "190px" }}
                              >
                                <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
                                  <div className="inline-flex items-center gap-2 rounded-full border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-200">
                                    <ListChecks className="size-3.5 text-fuchsia-300" />
                                    Particular
                                  </div>
                                  <Checkbox
                                    id={`particular-${task.id}`}
                                    checked={task.completed}
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleParticularTask(task.id)}
                                    className="w-5 h-5 border-zinc-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                                  />
                                </div>
                                <div className="flex flex-1 flex-col justify-between p-4">
                                  <div className="flex flex-col items-start">
                                    <Label htmlFor={`particular-${task.id}`} className="cursor-pointer text-sm md:text-base">
                                      <span className="line-clamp-2 uppercase">{task.label}</span>
                                      <span className="ml-1.5 text-xs font-normal text-zinc-400 normal-case">(tarea para vos)</span>
                                    </Label>
                                    <p className="mt-1 text-xs text-zinc-400">Toca para ver detalle de la tarea.</p>
                                  </div>
                                  <p className="mt-4 text-[11px] font-medium text-zinc-500">
                                    Ver detalle
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {advanceError && (
                    <p className="text-sm text-red-400">{advanceError}</p>
                  )}
                  {!isAccessPhase ? (
                    <div className="pt-4 max-w-sm">
                      <Button
                        onClick={handleFinishPhase}
                        disabled={
                          !nextPhase ||
                          !hasAnyTasks ||
                          !allTasksCompleted ||
                          finishing
                        }
                        className="w-full h-11 bg-zinc-900 border border-zinc-600 text-white rounded-full hover:bg-zinc-800 hover:border-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {finishing
                          ? "Enviando solicitud..."
                          : nextPhase === "done"
                            ? `Solicitar cierre del programa`
                            : nextPhase
                              ? `Solicitar paso a «${nextPhase}»`
                              : "Solicitar avance"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={!!taskModal} onOpenChange={(open) => !open && setTaskModal(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-white sm:max-w-2xl">
          {taskModal?.kind === "mandatory" ? (
            (() => {
              const task = tasks.find((t) => t.id === taskModal.taskId)
              if (!task) return null
              const templateDeliverableUrls = (task.deliverable_links ?? []).filter(Boolean)
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="uppercase">{task.label}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Enlaces de la tarea
                    </p>
                    <div className="space-y-1.5 text-sm">
                      {task.link_url?.trim() ? (
                        <a
                          href={task.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-purple-300 underline hover:text-purple-200"
                        >
                          Ver clase
                        </a>
                      ) : null}
                      {templateDeliverableUrls.map((url, i) => (
                        <a
                          key={`${task.slug}-modal-${i}`}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-fuchsia-300/90 underline hover:text-fuchsia-200"
                        >
                          Entregable {i + 1}
                        </a>
                      ))}
                      {!task.link_url?.trim() && templateDeliverableUrls.length === 0 ? (
                        <p className="text-zinc-500">Sin enlaces configurados.</p>
                      ) : null}
                    </div>
                    {userEmail ? (
                      <MandatoryTaskDeliverableBlock
                        userEmail={userEmail}
                        taskSlug={task.slug}
                        taskLabel={task.label}
                        stored={deliverables[task.slug]}
                        onSaved={() => void fetchDeliverables()}
                      />
                    ) : null}
                  </div>
                </>
              )
            })()
          ) : null}

          {taskModal?.kind === "particular" ? (
            (() => {
              const task = particularTasks.find((t) => t.id === taskModal.taskId)
              if (!task) return null
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="uppercase">{task.label}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 text-sm">
                    <p className="text-zinc-400">Tarea particular asignada por el director.</p>
                    {task.link_url ? (
                      <a
                        href={task.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-300 underline hover:text-purple-200"
                      >
                        Ver enlace
                      </a>
                    ) : (
                      <p className="text-zinc-500">Sin enlace.</p>
                    )}
                  </div>
                </>
              )
            })()
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
