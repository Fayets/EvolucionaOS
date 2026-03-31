"use client"

import { useState, useEffect, useCallback } from "react"
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

export function PhaseTasks({ phase }: { phase: string }) {
  const { userEmail, setClientPhase } = useApp()
  const [tasks, setTasks] = useState<TaskFromApi[]>([])
  const [particularTasks, setParticularTasks] = useState<ParticularTaskFromApi[]>([])
  const [completedSlugs, setCompletedSlugs] = useState<Set<string>>(new Set())
  const [awaitingDirector, setAwaitingDirector] = useState(false)
  const [pendingTargetPhase, setPendingTargetPhase] = useState<string | null>(null)
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deliverables, setDeliverables] = useState<
    Record<string, MandatoryDeliverableEntry>
  >({})

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
      await fetchDeliverables()
      setLoading(false)
    }
    load()
  }, [userEmail, fetchTasks, fetchCompletion, fetchParticularTasks, fetchDeliverables])

  useEffect(() => {
    const refreshTasks = () => {
      fetchTasks()
      fetchCompletion()
      fetchParticularTasks()
      void fetchDeliverables()
    }
    window.addEventListener(CLIENT_NOTIFICATIONS_CHANGED, refreshTasks)
    return () => window.removeEventListener(CLIENT_NOTIFICATIONS_CHANGED, refreshTasks)
  }, [fetchTasks, fetchCompletion, fetchParticularTasks, fetchDeliverables])

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

  const allMandatoryCompleted = tasks.length === 0 || tasks.every(t => completedSlugs.has(t.slug))
  const allParticularCompleted = particularTasks.every(t => t.completed)
  const allTasksCompleted = allMandatoryCompleted && allParticularCompleted
  const hasAnyTasks = tasks.length > 0 || particularTasks.length > 0

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
          <ClientSidebar />
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
          <ClientSidebar />
          <div className="flex-1 flex flex-col items-center justify-start px-4 pt-10 pb-10">
            <div className="relative w-full max-w-xl">
              <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/60 via-fuchsia-500/60 to-purple-500/60 blur-2xl opacity-60" />
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

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col items-center">
      <ClientLayoutLogo />
      <div className="flex w-full flex-1">
        <ClientSidebar />
        <div className="flex-1 flex flex-col items-center justify-start px-4 pt-10 pb-10">
          <div className="relative w-full">
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/60 via-fuchsia-500/60 to-purple-500/60 blur-2xl opacity-60" />
            <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
              <CardHeader className="pb-3 border-b border-zinc-800 px-6 md:px-10 flex items-center">
                <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
                  {phase.toUpperCase()}
                </p>
              </CardHeader>
              <CardContent className="px-6 md:px-10 py-7">
                <div className="space-y-5">
                  {!hasAnyTasks ? (
                    <p className="text-zinc-400 text-sm">No hay tareas configuradas para esta fase.</p>
                  ) : (
                    <div className="space-y-4">
                      {tasks.map(task => {
                        const hasClass = Boolean(task.link_url?.trim())
                        const templateDeliverableUrls = (task.deliverable_links ?? []).filter(Boolean)
                        return (
                        <div
                          key={`m-${task.id}`}
                          className="flex flex-col gap-0 rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col items-start min-w-0">
                              <Label htmlFor={`task-${task.slug}`} className="text-sm md:text-base cursor-pointer">
                                <span className="uppercase">{task.label}</span>{" "}
                                <span className="font-semibold text-amber-300">OBLIGATORIO</span>
                              </Label>
                              <div className="flex flex-col items-start gap-0.5 mt-1">
                                {hasClass && task.link_url ? (
                                  <a
                                    href={task.link_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-purple-300 underline text-left hover:text-purple-200"
                                  >
                                    Ver clase
                                  </a>
                                ) : null}
                                {templateDeliverableUrls.map((url, i) => (
                                  <a
                                    key={`${task.slug}-d-${i}`}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-fuchsia-300/90 underline text-left hover:text-fuchsia-200"
                                  >
                                    Entregable {i + 1}
                                  </a>
                                ))}
                                {!hasClass && templateDeliverableUrls.length === 0 ? (
                                  <span className="text-xs text-zinc-500">Sin enlaces configurados</span>
                                ) : null}
                              </div>
                            </div>
                            <Checkbox
                              id={`task-${task.slug}`}
                              checked={completedSlugs.has(task.slug)}
                              onCheckedChange={() => toggleMandatoryTask(task.slug)}
                              className="w-5 h-5 shrink-0 border-zinc-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                            />
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
                        )
                      })}
                      {particularTasks.map(task => (
                        <div
                          key={`p-${task.id}`}
                          className="flex items-center justify-between gap-4 rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3"
                        >
                          <div className="flex flex-col items-start">
                            <Label htmlFor={`particular-${task.id}`} className="text-sm md:text-base cursor-pointer">
                              <span className="uppercase">{task.label}</span>
                              <span className="ml-1.5 text-xs font-normal text-zinc-400 normal-case">(tarea para vos)</span>
                            </Label>
                            {task.link_url ? (
                              <a
                                href={task.link_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-300 underline mt-1 text-left hover:text-purple-200"
                              >
                                Ver enlace
                              </a>
                            ) : (
                              <span className="text-xs text-zinc-500 mt-1">Sin enlace</span>
                            )}
                          </div>
                          <Checkbox
                            id={`particular-${task.id}`}
                            checked={task.completed}
                            onCheckedChange={() => toggleParticularTask(task.id)}
                            className="w-5 h-5 border-zinc-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {advanceError && (
                    <p className="text-sm text-red-400">{advanceError}</p>
                  )}
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
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
