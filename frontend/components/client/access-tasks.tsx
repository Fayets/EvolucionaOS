"use client"

import { useState, useEffect, useCallback } from "react"
import { useApp } from "@/lib/app-context"
import { apiFetch } from "@/lib/api"
import { CLIENT_NOTIFICATIONS_CHANGED } from "@/lib/use-client-notifications-sse"
import { ClientLayoutLogo, ClientSidebar } from "@/components/client-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
const PHASE_ACCESO = "Acceso"

interface TaskFromApi {
  id: number
  slug: string
  label: string
  link_url: string
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

export function AccessTasks() {
  const { userEmail, setClientPhase } = useApp()
  const [tasks, setTasks] = useState<TaskFromApi[]>([])
  const [particularTasks, setParticularTasks] = useState<ParticularTaskFromApi[]>([])
  const [completedSlugs, setCompletedSlugs] = useState<Set<string>>(new Set())
  const [phaseCompleted, setPhaseCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await apiFetch(`/mandatory-tasks?phase=${encodeURIComponent(PHASE_ACCESO)}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(Array.isArray(data) ? data : [])
      } else {
        setTasks([])
      }
    } catch {
      setTasks([])
    }
  }, [])

  const fetchParticularTasks = useCallback(async () => {
    if (!userEmail) return
    try {
      const res = await apiFetch(
        `/particular-tasks/all?email=${encodeURIComponent(userEmail)}&phase=${encodeURIComponent(PHASE_ACCESO)}`
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
  }, [userEmail])

  const fetchCompletion = useCallback(async () => {
    if (!userEmail) return
    try {
      const res = await apiFetch(
        `/mandatory-tasks-completion?email=${encodeURIComponent(userEmail)}&phase=${encodeURIComponent(PHASE_ACCESO)}`
      )
      if (res.ok) {
        const data = await res.json()
        setCompletedSlugs(new Set(data.completed_slugs || []))
      }
    } catch {
      // ignorar
    }
  }, [userEmail])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchTasks()
      await fetchCompletion()
      await fetchParticularTasks()
      setLoading(false)
    }
    load()
  }, [fetchTasks, fetchCompletion, fetchParticularTasks])

  // Actualizar la lista de tareas cuando llega una notificación (ej. nueva tarea particular)
  useEffect(() => {
    const refreshTasks = () => {
      fetchTasks()
      fetchCompletion()
      fetchParticularTasks()
    }
    window.addEventListener(CLIENT_NOTIFICATIONS_CHANGED, refreshTasks)
    return () => window.removeEventListener(CLIENT_NOTIFICATIONS_CHANGED, refreshTasks)
  }, [fetchTasks, fetchCompletion, fetchParticularTasks])

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

  const handleFinishPhase = async () => {
    if (!userEmail) return
    setFinishing(true)
    try {
      const res = await apiFetch("/users/client-phase", {
        method: "PUT",
        body: JSON.stringify({ email: userEmail, phase: "Onboarding" }),
      })
      if (res.ok) setPhaseCompleted(true)
    } catch {
      // ignore
    } finally {
      setFinishing(false)
    }
  }

  const handleGoToOnboarding = () => {
    setClientPhase("Onboarding")
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

  if (phaseCompleted) {
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
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-6 h-6 text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">
                    Fase de acceso completada
                  </h2>
                  <p className="text-sm text-zinc-300 mb-6">
                    El equipo fue notificado. En breve comenzará tu onboarding.
                  </p>
                  <Button
                    onClick={handleGoToOnboarding}
                    className="w-full max-w-xs mx-auto bg-purple-600 hover:bg-purple-700 text-white rounded-full"
                  >
                    Completar formulario de onboarding
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
                  NUEVAS TAREAS
                </p>
              </CardHeader>

              <CardContent className="px-6 md:px-10 py-7">
                <div className="space-y-5">
                  {!hasAnyTasks ? (
                    <p className="text-zinc-400 text-sm">No hay tareas configuradas para esta fase.</p>
                  ) : (
                    <div className="space-y-4">
                      {tasks.map(task => (
                        <div
                          key={`m-${task.id}`}
                          className="flex items-center justify-between gap-4 rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3"
                        >
                          <div className="flex flex-col items-start">
                            <Label
                              htmlFor={`task-${task.slug}`}
                              className="text-sm md:text-base cursor-pointer"
                            >
                              {task.label}{" "}
                              <span className="font-semibold text-amber-300">
                                OBLIGATORIO
                              </span>
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
                              <span className="text-xs text-zinc-500 mt-1">Sin enlace configurado</span>
                            )}
                          </div>
                          <Checkbox
                            id={`task-${task.slug}`}
                            checked={completedSlugs.has(task.slug)}
                            onCheckedChange={() => toggleMandatoryTask(task.slug)}
                            className="w-5 h-5 border-zinc-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                          />
                        </div>
                      ))}
                      {particularTasks.map(task => (
                        <div
                          key={`p-${task.id}`}
                          className="flex items-center justify-between gap-4 rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3"
                        >
                          <div className="flex flex-col items-start">
                            <Label
                              htmlFor={`particular-${task.id}`}
                              className="text-sm md:text-base cursor-pointer"
                            >
                              {task.label}
                              <span className="ml-1.5 text-xs font-normal text-zinc-400">(tarea para vos)</span>
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

                  <div className="pt-4 max-w-sm">
                    <Button
                      onClick={handleFinishPhase}
                      disabled={!hasAnyTasks || !allTasksCompleted || finishing}
                      className="w-full h-11 bg-zinc-900 border border-zinc-600 text-white rounded-full hover:bg-zinc-800 hover:border-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {finishing ? "Pasando a onboarding…" : "Terminar con fase \"Acceso\""}
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
