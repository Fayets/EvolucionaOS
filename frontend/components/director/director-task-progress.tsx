"use client"

import { useState, useEffect } from "react"
import { Check, Circle } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { CLIENT_PHASES } from "@/lib/phases"

type MandatoryTask = {
  slug: string
  label: string
  link_url: string
  phase: string
}

type ParticularTask = {
  id: number
  label: string
  link_url: string
  phase: string
  completed: boolean
}

export function DirectorTaskProgress({ email, phase }: { email: string; phase: string }) {
  const [mandatoryTasks, setMandatoryTasks] = useState<MandatoryTask[]>([])
  const [completedSlugs, setCompletedSlugs] = useState<Set<string>>(new Set())
  const [particularTasks, setParticularTasks] = useState<ParticularTask[]>([])
  const [loading, setLoading] = useState(true)

  const isProgramPhase = (CLIENT_PHASES as readonly string[]).includes(phase)

  useEffect(() => {
    if (!isProgramPhase) {
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([
      apiFetch(`/mandatory-tasks?phase=${encodeURIComponent(phase)}`).then(r =>
        r.ok ? r.json() : []
      ),
      apiFetch(
        `/mandatory-tasks-completion?email=${encodeURIComponent(email)}&phase=${encodeURIComponent(phase)}`
      ).then(r => (r.ok ? r.json() : { completed_slugs: [] })),
      apiFetch(
        `/particular-tasks/all?email=${encodeURIComponent(email)}&phase=${encodeURIComponent(phase)}`
      ).then(r => (r.ok ? r.json() : { tasks: [] })),
    ])
      .then(([tasks, completion, particular]) => {
        setMandatoryTasks(Array.isArray(tasks) ? tasks : [])
        setCompletedSlugs(
          new Set(Array.isArray(completion.completed_slugs) ? completion.completed_slugs : [])
        )
        setParticularTasks(Array.isArray(particular.tasks) ? particular.tasks : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [email, phase, isProgramPhase])

  if (!isProgramPhase) {
    return (
      <p className="text-[13px] text-zinc-600 py-2">
        Esta fase no tiene tareas asignables.
      </p>
    )
  }

  if (loading) {
    return <p className="text-[13px] text-zinc-500 py-2">Cargando tareas…</p>
  }

  const hasMandatory = mandatoryTasks.length > 0
  const hasParticular = particularTasks.length > 0

  if (!hasMandatory && !hasParticular) {
    return (
      <p className="text-[13px] text-zinc-600 py-2">
        No hay tareas definidas para esta fase.
      </p>
    )
  }

  const mandatoryCompleted = mandatoryTasks.filter(t => completedSlugs.has(t.slug)).length
  const particularCompleted = particularTasks.filter(t => t.completed).length
  const totalTasks = mandatoryTasks.length + particularTasks.length
  const totalCompleted = mandatoryCompleted + particularCompleted

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          className="h-1.5 flex-1 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0}%`,
              background: totalCompleted === totalTasks ? "#22c55e" : "#a855f7",
            }}
          />
        </div>
        <span className="text-[12px] text-zinc-500 tabular-nums shrink-0">
          {totalCompleted}/{totalTasks}
        </span>
      </div>

      {hasMandatory && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1">Obligatorias</p>
          {mandatoryTasks.map(t => {
            const done = completedSlugs.has(t.slug)
            return (
              <div key={t.slug} className="flex items-center gap-2.5 py-1">
                {done ? (
                  <Check size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <Circle size={14} className="text-zinc-700 shrink-0" />
                )}
                <span
                  className={`text-[13px] uppercase ${done ? "text-zinc-400 line-through" : "text-zinc-300"}`}
                >
                  {t.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {hasParticular && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 mt-1">
            Particulares
          </p>
          {particularTasks.map(t => (
            <div key={t.id} className="flex items-center gap-2.5 py-1">
              {t.completed ? (
                <Check size={14} className="text-emerald-400 shrink-0" />
              ) : (
                <Circle size={14} className="text-zinc-700 shrink-0" />
              )}
              <span
                className={`text-[13px] uppercase ${t.completed ? "text-zinc-400 line-through" : "text-zinc-300"}`}
              >
                {t.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Solo particulares (pestaña dedicada). */
export function DirectorParticularTasksList({
  email,
  phase,
}: {
  email: string
  phase: string
}) {
  const [particularTasks, setParticularTasks] = useState<ParticularTask[]>([])
  const [loading, setLoading] = useState(true)

  const isProgramPhase = (CLIENT_PHASES as readonly string[]).includes(phase)

  useEffect(() => {
    if (!isProgramPhase) {
      setLoading(false)
      return
    }
    setLoading(true)
    apiFetch(
      `/particular-tasks/all?email=${encodeURIComponent(email)}&phase=${encodeURIComponent(phase)}`
    )
      .then(r => (r.ok ? r.json() : { tasks: [] }))
      .then(data => setParticularTasks(Array.isArray(data.tasks) ? data.tasks : []))
      .catch(() => setParticularTasks([]))
      .finally(() => setLoading(false))
  }, [email, phase, isProgramPhase])

  if (!isProgramPhase) {
    return <p className="text-sm text-zinc-500 py-4">Sin tareas particulares en esta fase.</p>
  }
  if (loading) {
    return <p className="text-sm text-zinc-500 py-4">Cargando…</p>
  }
  if (particularTasks.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-4">No hay tareas particulares en esta fase.</p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {particularTasks.map(t => (
        <li
          key={t.id}
          className="flex items-center gap-3 rounded-xl border border-zinc-800/90 bg-zinc-950/60 px-4 py-3"
        >
          {t.completed ? (
            <Check className="size-4 shrink-0 text-emerald-400" />
          ) : (
            <Circle className="size-4 shrink-0 text-zinc-600" />
          )}
          <span
            className={`text-[13px] uppercase ${t.completed ? "text-zinc-500 line-through" : "text-zinc-200"}`}
          >
            {t.label}
          </span>
        </li>
      ))}
    </ul>
  )
}
