"use client"

import { useState, useEffect, useCallback, useMemo, startTransition } from "react"
import dynamic from "next/dynamic"
import { jsPDF } from "jspdf"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRegisteredUsers } from "@/lib/registered-users-context"
import { ONBOARDING_QUESTIONS } from "@/components/client/onboarding-questions"
import { apiFetch } from "@/lib/api"
import { CLIENT_PHASES } from "@/lib/phases"
import { Check, Circle, FilePlus, Search, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"

const RegisterUserFormLazy = dynamic(
  () => import("./register-user-form").then(m => m.RegisterUserForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[10rem] items-center justify-center py-6 text-sm text-zinc-500">
        Cargando…
      </div>
    ),
  }
)

const DirectorGenerateTaskLazy = dynamic(
  () => import("./director-generate-task").then(m => m.DirectorGenerateTask),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[12rem] items-center justify-center py-6 text-sm text-zinc-500">
        Cargando…
      </div>
    ),
  }
)

function prefetchUserDialogs() {
  void import("./register-user-form")
  void import("./director-generate-task")
}

type MandatoryDeliverableRow = {
  label: string
  note: string
  link: string
  submitted_at: string
  director_note?: string
  director_link?: string
  corrected_at?: string
}

type UserDetail = {
  id: number
  email: string
  role: string
  created_at: string | null
  updated_at: string | null
  client: {
    phase: string
    phone: string | null
    email: string | null
    onboarding_responses: Record<string, string> | null
    mandatory_task_deliverables: Record<string, MandatoryDeliverableRow> | null
  } | null
}

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

/**
 * Orden del desplegable (director). CLIENT_PHASES empieza con "Acceso" y "Onboarding";
 * en BD aún existen aliases legacy "tasks" y "onboarding" (minúscula) con la misma etiqueta
 * visible → no deben listarse ambos pares o el Select muestra duplicados.
 */
const DIRECTOR_PHASE_BASE: string[] = [
  "initial",
  "platforms",
  "Acceso",
  "Onboarding",
  ...CLIENT_PHASES.slice(2),
]

function phaseSelectValues(currentPhase: string | undefined): string[] {
  const seenLabels = new Set<string>()
  const out: string[] = []

  for (const p of DIRECTOR_PHASE_BASE) {
    let value = p
    if (currentPhase === "tasks" && p === "Acceso") value = "tasks"
    else if (currentPhase === "onboarding" && p === "Onboarding") {
      value = "onboarding"
    }

    const lb = phaseName(value)
    if (seenLabels.has(lb)) continue
    seenLabels.add(lb)
    out.push(value)
  }

  if (currentPhase && !out.includes(currentPhase)) {
    out.unshift(currentPhase)
  }
  return out
}

const phaseLabel: Record<string, string> = {
  initial: "Datos iniciales",
  platforms: "Acceso a plataformas",
  Acceso: "Acceso",
  Onboarding: "Onboarding",
  "Base de Negocios": "Bases de negocio",
  Marketing: "Marketing",
  "Proceso de Ventas": "Proceso de ventas",
  Optimizar: "Optimizar",
  done: "Programa completo",
  tasks: "Acceso",
  onboarding: "Onboarding",
  "Bases de Negocio": "Bases de negocio",
  "Marketing y Comunicación": "Marketing",
  "Procesos de Venta": "Proceso de ventas",
  "Creación de Funnels": "Marketing",
  "Ecosistema de Contenido": "Proceso de ventas",
  "Producto y Funnel Interno": "Optimizar",
}

function phaseName(phase: string): string {
  return phaseLabel[phase] ?? phase
}

/** Orden fijo del filtro (valores en BD / canónicos), alineado al recorrido del programa. */
const PHASE_FILTER_ORDER: readonly string[] = [
  "initial",
  "platforms",
  "Acceso",
  "Onboarding",
  "Base de Negocios",
  "Marketing",
  "Proceso de Ventas",
  "Optimizar",
  "done",
]

/** Una opción por etiqueta visible; orden fijo, sin ordenar alfabéticamente. */
function buildPhaseFilterDropdown(): { value: string; label: string }[] {
  const seen = new Set<string>()
  const out: { value: string; label: string }[] = []
  for (const p of PHASE_FILTER_ORDER) {
    const label = phaseName(p)
    if (seen.has(label)) continue
    seen.add(label)
    out.push({ value: p, label })
  }
  return out
}

const PHASE_FILTER_DROPDOWN = buildPhaseFilterDropdown()

/** Incluye fases que aparecen en datos pero no en el catálogo (legacy); se agregan al final. */
function mergePhaseFilterFromUsers(
  usersList: { clientPhase: string | null }[]
): { value: string; label: string }[] {
  const seenLabels = new Set(PHASE_FILTER_DROPDOWN.map(o => o.label))
  const extra: { value: string; label: string }[] = []
  for (const u of usersList) {
    if (!u.clientPhase) continue
    const label = phaseName(u.clientPhase)
    if (seenLabels.has(label)) continue
    seenLabels.add(label)
    extra.push({ value: u.clientPhase, label })
  }
  extra.sort((a, b) =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" })
  )
  return [...PHASE_FILTER_DROPDOWN, ...extra]
}

function userMatchesPhaseFilter(
  clientPhase: string | null,
  selected: string,
  all: string
): boolean {
  if (selected === all) return true
  if (!clientPhase) return false
  return phaseName(clientPhase) === phaseName(selected)
}

// ── PDF generation ──

let cachedLogoDataUrl: string | null = null

async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl
  if (typeof window === "undefined") return null
  try {
    const img = new Image()
    img.src = "/EvolucionaLogoLogin.png"
    const dataUrl = await new Promise<string>((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const maxWidth = 160
        const scale = Math.min(1, maxWidth / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("canvas")); return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/png"))
      }
      img.onerror = () => reject(new Error("logo"))
    })
    cachedLogoDataUrl = dataUrl
    return dataUrl
  } catch { return null }
}

async function downloadOnboardingPdf(detail: UserDetail) {
  if (!detail.client?.onboarding_responses) return
  const doc = new jsPDF()
  let y = 26
  doc.setFillColor(7, 7, 10)
  doc.rect(0, 0, 210, 45, "F")
  const logo = await getLogoDataUrl()
  if (logo) { doc.addImage(logo, "PNG", 15, 8, 28, 28); y = 30 }
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Formulario de onboarding", 110, 20, { align: "left" })
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(220, 220, 220)
  doc.text(`Cliente: ${detail.email}`, 110, 27, { align: "left" })
  doc.text("Este documento resume el formulario de onboarding completado en Evoluciona.", 110, 32, { align: "left", maxWidth: 90 })
  y = 55
  doc.setTextColor(0, 0, 0)
  let index = 1
  const answers = detail.client.onboarding_responses
  const addWrappedText = (text: string, x: number, startY: number, maxWidth: number) => {
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, x, startY)
    return startY + lines.length * 5
  }
  for (const q of ONBOARDING_QUESTIONS) {
    const value = answers[q.key]
    if (value == null || String(value).trim() === "") continue
    if (y > 260) { doc.addPage(); y = 22 }
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    y = addWrappedText(`${index}. ${q.label}`, 15, y, 180)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    y = addWrappedText(String(value), 15, y + 2, 180)
    y += 6
    index += 1
  }
  const safeEmail = detail.email.replace(/[^a-zA-Z0-9_.-]/g, "_")
  doc.save(`onboarding-${safeEmail}.pdf`)
}

// ── Task progress section ──

function TaskProgress({ email, phase }: { email: string; phase: string }) {
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
      apiFetch(`/mandatory-tasks?phase=${encodeURIComponent(phase)}`).then(r => r.ok ? r.json() : []),
      apiFetch(`/mandatory-tasks-completion?email=${encodeURIComponent(email)}&phase=${encodeURIComponent(phase)}`).then(r => r.ok ? r.json() : { completed_slugs: [] }),
      apiFetch(`/particular-tasks/all?email=${encodeURIComponent(email)}&phase=${encodeURIComponent(phase)}`).then(r => r.ok ? r.json() : { tasks: [] }),
    ])
      .then(([tasks, completion, particular]) => {
        setMandatoryTasks(Array.isArray(tasks) ? tasks : [])
        setCompletedSlugs(new Set(Array.isArray(completion.completed_slugs) ? completion.completed_slugs : []))
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
      {/* Summary */}
      <div className="flex items-center gap-3">
        <div
          className="h-1.5 flex-1 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0}%`,
              background: totalCompleted === totalTasks ? "#22c55e" : "#8b5cf6",
            }}
          />
        </div>
        <span className="text-[12px] text-zinc-500 tabular-nums shrink-0">
          {totalCompleted}/{totalTasks}
        </span>
      </div>

      {/* Mandatory tasks */}
      {hasMandatory && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1">Obligatorias</p>
          {mandatoryTasks.map(t => {
            const done = completedSlugs.has(t.slug)
            return (
              <div key={t.slug} className="flex items-center gap-2.5 py-1">
                {done ? (
                  <Check size={14} className="text-green-500 shrink-0" />
                ) : (
                  <Circle size={14} className="text-zinc-700 shrink-0" />
                )}
                <span className={`text-[13px] uppercase ${done ? "text-zinc-400 line-through" : "text-zinc-300"}`}>
                  {t.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Particular tasks */}
      {hasParticular && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 mt-1">Particulares</p>
          {particularTasks.map(t => (
            <div key={t.id} className="flex items-center gap-2.5 py-1">
              {t.completed ? (
                <Check size={14} className="text-green-500 shrink-0" />
              ) : (
                <Circle size={14} className="text-zinc-700 shrink-0" />
              )}
              <span className={`text-[13px] uppercase ${t.completed ? "text-zinc-400 line-through" : "text-zinc-300"}`}>
                {t.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ──

const PHASE_FILTER_ALL = "__all__"

const usersListScrollClass =
  "min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] max-h-[min(22rem,45vh)]"

/**
 * Misma pintura para «Tarea a usuario» y «Usuario»: `<button>` nativo para que el variant
 * `outline` de `Button` no inyecte `bg-background` / `dark:bg-input` y las dos se vean iguales.
 */
const USER_VIEW_TOOLBAR_BTN_CLASS = cn(
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-zinc-600 bg-zinc-950/80 px-3 text-sm font-medium text-zinc-200 shadow-xs",
  "transition-colors hover:bg-zinc-900 hover:text-white",
  "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
  "disabled:pointer-events-none disabled:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
)

export function RegisteredUsersList() {
  const { users, removeUser, listLoading, listFetchFailed, refreshFromServer } =
    useRegisteredUsers()
  const [searchQuery, setSearchQuery] = useState("")
  const [phaseFilter, setPhaseFilter] = useState(PHASE_FILTER_ALL)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [viewEmail, setViewEmail] = useState<string | null>(null)
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [phaseUpdating, setPhaseUpdating] = useState(false)
  const [initClientLoading, setInitClientLoading] = useState(false)
  const [correctionFor, setCorrectionFor] = useState<{
    slug: string
    label: string
  } | null>(null)
  const [corrNote, setCorrNote] = useState("")
  const [corrLink, setCorrLink] = useState("")
  const [corrSaving, setCorrSaving] = useState(false)
  const [corrErr, setCorrErr] = useState<string | null>(null)

  const fetchDetail = useCallback(async (email: string) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const res = await apiFetch(`/users/detail?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = await res.json() as UserDetail
        setDetail(data)
        return
      }
      if (res.status === 401) {
        throw new Error("Sesión expirada o no autorizado. Volvé a iniciar sesión como director.")
      }
      if (res.status === 404) {
        const userToRemove = users.find(u => u.username === email)
        if (userToRemove) removeUser(userToRemove.id)
        setViewEmail(null)
        throw new Error("Usuario no encontrado")
      }
      throw new Error(`Error al cargar (${res.status})`)
    } catch (err) {
      if (err instanceof SyntaxError) {
        setDetailError("Respuesta inválida del servidor.")
      } else {
        setDetailError(err instanceof Error ? err.message : "Error al cargar")
      }
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [users, removeUser])

  useEffect(() => {
    if (!viewEmail) { setDetail(null); setDetailError(null); return }
    fetchDetail(viewEmail)
  }, [viewEmail, fetchDetail])

  useEffect(() => {
    if (!correctionFor || !detail?.client?.mandatory_task_deliverables) {
      setCorrNote("")
      setCorrLink("")
      return
    }
    const row = detail.client.mandatory_task_deliverables[correctionFor.slug]
    setCorrNote(row?.director_note ?? "")
    setCorrLink(row?.director_link ?? "")
    setCorrErr(null)
  }, [correctionFor, detail?.client?.mandatory_task_deliverables])

  const handlePhaseChange = async (newPhase: string) => {
    if (!detail || !viewEmail) return
    setPhaseUpdating(true)
    try {
      const res = await apiFetch("/users/client-phase", {
        method: "PUT",
        body: JSON.stringify({ email: viewEmail, phase: newPhase }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        message?: string
      }
      if (res.ok && data.success !== false) {
        setDetail(prev => prev ? {
          ...prev,
          client: prev.client ? { ...prev.client, phase: newPhase } : prev.client,
        } : prev)
      } else {
        alert(data.message || "No se pudo actualizar la fase del cliente.")
      }
    } catch {
      alert("Error de conexión al actualizar la fase.")
    }
    setPhaseUpdating(false)
  }

  /** Clientes viejos sin fila Client en BD: crea ficha con fase initial. */
  const handleInitClientRecord = async () => {
    if (!viewEmail || !detail) return
    setInitClientLoading(true)
    try {
      const res = await apiFetch("/users/client-phase", {
        method: "PUT",
        body: JSON.stringify({ email: viewEmail, phase: "initial" }),
      })
      if (res.ok) await fetchDetail(viewEmail)
    } catch {
      /* ignore */
    } finally {
      setInitClientLoading(false)
    }
  }

  const handleSubmitDeliverableCorrection = async () => {
    if (!viewEmail || !correctionFor) return
    const note = corrNote.trim()
    const link = corrLink.trim()
    if (!note && !link) {
      setCorrErr("Agregá un comentario o un enlace.")
      return
    }
    setCorrErr(null)
    setCorrSaving(true)
    try {
      const res = await apiFetch("/users/mandatory-deliverables/director-feedback", {
        method: "PUT",
        body: JSON.stringify({
          student_email: viewEmail,
          task_slug: correctionFor.slug,
          director_note: note || undefined,
          director_link: link || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { detail?: string }
      if (!res.ok) {
        setCorrErr(
          typeof data.detail === "string" ? data.detail : "No se pudo enviar la corrección"
        )
        return
      }
      setCorrectionFor(null)
      await fetchDetail(viewEmail)
    } catch {
      setCorrErr("Error de conexión")
    } finally {
      setCorrSaving(false)
    }
  }

  const handleQuitar = async (user: { id: string; username: string }) => {
    try {
      await apiFetch(`/users/by-email?email=${encodeURIComponent(user.username)}`, { method: "DELETE" })
    } catch {}
    removeUser(user.id)
    if (viewEmail === user.username) setViewEmail(null)
  }

  const phaseFilterItems = useMemo(
    () => mergePhaseFilterFromUsers(users),
    [users]
  )

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return users.filter(u => {
      if (q && !u.username.toLowerCase().includes(q)) return false
      if (!userMatchesPhaseFilter(u.clientPhase, phaseFilter, PHASE_FILTER_ALL))
        return false
      return true
    })
  }, [users, searchQuery, phaseFilter])

  const completedProgramCount = useMemo(
    () => users.filter(u => u.clientPhase === "done").length,
    [users]
  )

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4">
        <div className="relative w-full min-w-0 flex-1 lg:max-w-xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar usuario…"
            className="h-11 border-zinc-700 bg-zinc-950/90 pl-10 text-white placeholder:text-zinc-500"
            autoComplete="off"
          />
        </div>
        <div
          className="flex flex-wrap items-center gap-3"
          onPointerEnter={prefetchUserDialogs}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500 shrink-0">Fase:</span>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="h-10 min-w-[13rem] max-w-[min(100%,18rem)] border-zinc-700 bg-zinc-950/90 text-white text-sm">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="max-h-[min(320px,50vh)] border-zinc-700 bg-zinc-900 text-white overflow-y-auto">
                <SelectItem value={PHASE_FILTER_ALL} className="focus:bg-zinc-800 focus:text-white">
                  Todas
                </SelectItem>
                {phaseFilterItems.map(({ value, label }) => (
                  <SelectItem
                    key={`${value}-${label}`}
                    value={value}
                    className="focus:bg-zinc-800 focus:text-white"
                  >
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            className={USER_VIEW_TOOLBAR_BTN_CLASS}
            onClick={() =>
              startTransition(() => {
                setTaskOpen(true)
              })
            }
          >
            <FilePlus className="shrink-0" aria-hidden />
            Tarea a usuario
          </button>
          <button
            type="button"
            className={USER_VIEW_TOOLBAR_BTN_CLASS}
            onClick={() =>
              startTransition(() => {
                setRegisterOpen(true)
              })
            }
          >
            <UserPlus className="shrink-0" aria-hidden />
            Usuario
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px] xl:items-start">
        <div className="relative w-full min-w-0">
          <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/40 via-fuchsia-500/40 to-purple-500/40 blur-2xl opacity-50" />
          <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
            <CardHeader className="border-b border-zinc-800 px-6 md:px-8 pb-3">
              <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
                Usuarios registrados
              </p>
            </CardHeader>
            <CardContent className="px-6 md:px-8 py-6">
              {listLoading ? (
                <p className="text-sm text-zinc-500 text-center py-8">Cargando usuarios…</p>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <p className="text-sm text-zinc-500 text-center">
                    {listFetchFailed
                      ? "No se pudo cargar el listado desde el servidor (sesión o conexión). Podés reintentar o revisar que el API esté disponible."
                      : "No hay usuarios clientes registrados todavía."}
                  </p>
                  {listFetchFailed && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 bg-zinc-900 text-xs text-zinc-100 hover:bg-zinc-800"
                      onClick={() => void refreshFromServer()}
                    >
                      Reintentar
                    </Button>
                  )}
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">
                  Ningún usuario coincide con la búsqueda o el filtro de fase.
                </p>
              ) : (
                <ul className={`flex flex-col divide-y divide-zinc-800 ${usersListScrollClass}`}>
                  {filteredUsers.map(user => (
                    <li
                      key={user.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{user.username}</p>
                        <p className="text-xs text-zinc-500">
                          Alta:{" "}
                          {new Date(user.createdAt).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-zinc-300 hover:text-white hover:bg-zinc-800"
                          onClick={() => setViewEmail(user.username)}
                        >
                          Ver
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-zinc-400 hover:text-red-400 hover:bg-zinc-900"
                          onClick={() => handleQuitar(user)}
                        >
                          Quitar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/90 px-4 py-4 text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Total clientes
            </p>
            <p className="mt-2 text-4xl font-semibold tabular-nums">{users.length}</p>
            <p className="mt-1 text-xs text-zinc-500">Listado actual</p>
          </div>
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/90 px-4 py-4 text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Programa completo
            </p>
            <p className="mt-2 text-4xl font-semibold tabular-nums">{completedProgramCount}</p>
            <p className="mt-1 text-xs text-zinc-500">Fase «Programa completo»</p>
          </div>
        </aside>
      </div>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-white !duration-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Registrar usuario</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Alta de usuario en el sistema (mismo flujo que antes en «Registrar»).
            </DialogDescription>
          </DialogHeader>
          <RegisterUserFormLazy
            embedded
            onRegistered={() => {
              setRegisterOpen(false)
              void import("./director-generate-task").then(m =>
                m.invalidateDirectorGenerateClientsCache()
              )
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto border-zinc-800 bg-zinc-950 text-white !duration-100 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Tarea a usuario</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Crear una tarea particular para un alumno y una fase.
            </DialogDescription>
          </DialogHeader>
          <DirectorGenerateTaskLazy embedded />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewEmail} onOpenChange={(open) => !open && setViewEmail(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-white max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">Información del usuario</DialogTitle>
          </DialogHeader>
          {detailLoading && <p className="text-sm text-zinc-500 py-4">Cargando...</p>}
          {detailError && <p className="text-sm text-red-400 py-4">{detailError}</p>}
          {!detailLoading && !detailError && detail && (
            <div className="flex flex-col gap-3 text-sm overflow-y-auto pr-2">
              <div>
                <span className="text-zinc-500">Email:</span>{" "}
                <span className="text-white">{detail.email}</span>
              </div>
              <div>
                <span className="text-zinc-500">Rol:</span>{" "}
                <span className="text-white">{detail.role}</span>
              </div>
              <div>
                <span className="text-zinc-500">Alta:</span>{" "}
                <span className="text-white">
                  {detail.created_at
                    ? new Date(detail.created_at).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })
                    : "—"}
                </span>
              </div>
              {!detail.client && String(detail.role).includes("CLIENTE") && (
                <div className="border-t border-zinc-800 pt-3 mt-2 rounded-md border border-amber-900/50 bg-amber-950/20 px-3 py-3">
                  <p className="text-sm text-amber-200/90 mb-2">
                    Este cliente no tiene ficha en el sistema (usuarios creados antes del arreglo o sin primer login).
                    Podés crear la ficha para ver fase, tareas y onboarding.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={initClientLoading}
                    className="border-amber-800/60 bg-zinc-900 text-amber-100 hover:bg-zinc-800"
                    onClick={() => void handleInitClientRecord()}
                  >
                    {initClientLoading ? "Creando…" : "Crear ficha de cliente"}
                  </Button>
                </div>
              )}
              {detail.client && (
                <>
                  {/* Phase selector */}
                  <div className="border-t border-zinc-800 pt-3 mt-1">
                    <p className="text-zinc-400 font-medium mb-3">Datos de cliente</p>
                    <div className="flex flex-col gap-3 pl-0">
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500 shrink-0">Fase:</span>
                        <Select
                          value={detail.client.phase}
                          onValueChange={handlePhaseChange}
                          disabled={phaseUpdating}
                        >
                          <SelectTrigger className="w-full max-w-[260px] h-8 border-zinc-700 bg-zinc-900 text-white text-[13px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-zinc-700 bg-zinc-900 text-white">
                            {phaseSelectValues(detail.client.phase).map(p => (
                              <SelectItem key={p} value={p} className="text-[13px] focus:bg-zinc-800 focus:text-white">
                                {phaseName(p)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {detail.client.phone && (
                        <div>
                          <span className="text-zinc-500">Celular:</span>{" "}
                          <span className="text-white">{detail.client.phone}</span>
                        </div>
                      )}
                      {detail.client.email && detail.client.email !== detail.email && (
                        <div>
                          <span className="text-zinc-500">Email (cliente):</span>{" "}
                          <span className="text-white">{detail.client.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task progress */}
                  <div className="border-t border-zinc-800 pt-3 mt-1">
                    <p className="text-zinc-400 font-medium mb-3">Progreso de tareas</p>
                    <TaskProgress email={detail.email} phase={detail.client.phase} />
                  </div>

                  {detail.client.mandatory_task_deliverables &&
                    Object.keys(detail.client.mandatory_task_deliverables).length > 0 && (
                      <div className="border-t border-zinc-800 pt-3 mt-3">
                        <p className="text-zinc-400 font-medium mb-2">Entregables enviados</p>
                        <div className="flex flex-col gap-3">
                          {[...Object.entries(detail.client.mandatory_task_deliverables)]
                            .sort(
                              (a, b) =>
                                new Date(b[1].submitted_at).getTime() -
                                new Date(a[1].submitted_at).getTime()
                            )
                            .map(([slug, row]) => (
                              <div
                                key={slug}
                                className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2.5"
                              >
                                <p className="text-[13px] font-medium text-white uppercase tracking-wide">
                                  {row.label || slug}
                                </p>
                                {row.note ? (
                                  <p className="text-[13px] text-zinc-300 mt-1.5 whitespace-pre-wrap">
                                    {row.note}
                                  </p>
                                ) : null}
                                {row.link ? (
                                  <a
                                    href={row.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block text-xs text-purple-300 underline mt-1.5 hover:text-purple-200"
                                  >
                                    Abrir enlace del alumno
                                  </a>
                                ) : null}
                                <p className="text-[11px] text-zinc-500 mt-1.5">
                                  {new Date(row.submitted_at).toLocaleString("es-AR", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </p>
                                {(row.director_note || row.director_link) &&
                                row.corrected_at ? (
                                  <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-amber-200/80 mb-1">
                                      Última corrección al alumno
                                    </p>
                                    {row.director_note ? (
                                      <p className="text-[12px] text-zinc-200 whitespace-pre-wrap">
                                        {row.director_note}
                                      </p>
                                    ) : null}
                                    {row.director_link ? (
                                      <a
                                        href={row.director_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-purple-300 underline mt-1 inline-block"
                                      >
                                        Enlace enviado
                                      </a>
                                    ) : null}
                                    <p className="text-[10px] text-zinc-500 mt-1">
                                      {new Date(row.corrected_at).toLocaleString("es-AR", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                      })}
                                    </p>
                                  </div>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 h-8 border-zinc-600 bg-zinc-900 text-xs text-zinc-100 hover:bg-zinc-800"
                                  onClick={() =>
                                    setCorrectionFor({ slug, label: row.label || slug })
                                  }
                                >
                                  Corregir y reenviar al alumno
                                </Button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                  {/* Onboarding PDF */}
                  {detail.client.onboarding_responses &&
                    Object.keys(detail.client.onboarding_responses).length > 0 && (
                      <div className="border-t border-zinc-800 pt-3 mt-3">
                        <div className="flex items-center justify-between mb-2 gap-3">
                          <p className="text-zinc-400 font-medium">Formulario de onboarding</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-zinc-700 bg-zinc-900 text-xs text-zinc-100 hover:bg-zinc-800"
                            onClick={() => downloadOnboardingPdf(detail)}
                          >
                            Descargar PDF
                          </Button>
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!correctionFor}
        onOpenChange={(open) => {
          if (!open) setCorrectionFor(null)
        }}
      >
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Corregir y reenviar al alumno</DialogTitle>
            <DialogDescription className="text-zinc-500 text-left">
              El alumno verá esto en su tarea y recibirá una notificación en la app.
            </DialogDescription>
          </DialogHeader>
          {correctionFor ? (
            <p className="text-sm font-medium text-white uppercase tracking-wide -mt-1 mb-2">
              {correctionFor.label}
            </p>
          ) : null}
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="corr-note" className="text-zinc-300 text-xs">
                Comentario / indicaciones
              </Label>
              <Textarea
                id="corr-note"
                value={corrNote}
                onChange={(e) => setCorrNote(e.target.value)}
                rows={4}
                placeholder="Qué debe ajustar o mejorar…"
                className="resize-y bg-zinc-900 border-zinc-700 text-white text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="corr-link" className="text-zinc-300 text-xs">
                Enlace (opcional)
              </Label>
              <Input
                id="corr-link"
                value={corrLink}
                onChange={(e) => setCorrLink(e.target.value)}
                type="text"
                inputMode="url"
                placeholder="https://..."
                className="h-10 bg-zinc-900 border-zinc-700 text-white text-sm"
              />
            </div>
            {corrErr ? <p className="text-sm text-red-400">{corrErr}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-600 text-white bg-transparent"
              onClick={() => setCorrectionFor(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={corrSaving}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => void handleSubmitDeliverableCorrection()}
            >
              {corrSaving ? "Enviando…" : "Enviar al alumno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
