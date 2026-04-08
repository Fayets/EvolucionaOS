"use client"

import { useState, useEffect, useCallback } from "react"
import { jsPDF } from "jspdf"
import { ChevronLeft, ArrowRight } from "lucide-react"
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
import { ONBOARDING_QUESTIONS } from "@/components/client/onboarding-questions"
import { apiFetch } from "@/lib/api"
import {
  phaseName,
  phaseSelectValues,
} from "@/components/director/director-phase-labels"
import {
  DirectorTaskProgress,
  DirectorParticularTasksList,
} from "@/components/director/director-task-progress"
import { DirectorDeliverablesGoogleGrid } from "@/components/director/director-deliverables-grid"
import { cn } from "@/lib/utils"
import { DIRECTOR_TOOLBAR_BUTTON_CLASS } from "@/components/director/director-toolbar-styles"

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

const PHASE_ADVANCE_ORDER = [
  "initial",
  "platforms",
  "Acceso",
  "Onboarding",
  "Base de Negocios",
  "Marketing",
  "Proceso de Ventas",
  "Optimizar",
  "done",
] as const

function normalizeStoredPhase(p: string): string {
  if (p === "tasks") return "Acceso"
  if (p === "onboarding") return "Onboarding"
  if (p === "Bases de Negocio") return "Base de Negocios"
  return p
}

function getNextStoredPhase(current: string): string | null {
  const n = normalizeStoredPhase(current)
  const i = PHASE_ADVANCE_ORDER.indexOf(n as (typeof PHASE_ADVANCE_ORDER)[number])
  if (i === -1 || i === PHASE_ADVANCE_ORDER.length - 1) return null
  return PHASE_ADVANCE_ORDER[i + 1]
}

const TIMELINE: { ids: string[]; short: string }[] = [
  { ids: ["initial"], short: "INICIO" },
  { ids: ["platforms"], short: "PLAT." },
  { ids: ["Acceso", "tasks"], short: "ACCESO" },
  { ids: ["Onboarding", "onboarding"], short: "ONBOARD" },
  { ids: ["Base de Negocios", "Bases de Negocio"], short: "BASE" },
  { ids: ["Marketing"], short: "MARKETING" },
  { ids: ["Proceso de Ventas", "Procesos de Venta"], short: "VENTAS" },
  { ids: ["Optimizar"], short: "OPTIMIZAR" },
  { ids: ["done"], short: "FIN" },
]

function timelineIndex(phase: string): number {
  const p = phase.trim()
  for (let i = 0; i < TIMELINE.length; i++) {
    if (TIMELINE[i].ids.some(id => id === p)) return i
  }
  for (let i = 0; i < TIMELINE.length; i++) {
    if (TIMELINE[i].ids.some(id => phaseName(id) === phaseName(p))) return i
  }
  return 0
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email
  if (!local) return email
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase()
}

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
        if (!ctx) {
          reject(new Error("canvas"))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/png"))
      }
      img.onerror = () => reject(new Error("logo"))
    })
    cachedLogoDataUrl = dataUrl
    return dataUrl
  } catch {
    return null
  }
}

async function downloadOnboardingPdf(detail: UserDetail) {
  if (!detail.client?.onboarding_responses) return
  const doc = new jsPDF()
  let y = 26
  doc.setFillColor(7, 7, 10)
  doc.rect(0, 0, 210, 45, "F")
  const logo = await getLogoDataUrl()
  if (logo) {
    doc.addImage(logo, "PNG", 15, 8, 28, 28)
    y = 30
  }
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Formulario de onboarding", 110, 20, { align: "left" })
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(220, 220, 220)
  doc.text(`Cliente: ${detail.email}`, 110, 27, { align: "left" })
  doc.text(
    "Este documento resume el formulario de onboarding completado en Evoluciona.",
    110,
    32,
    { align: "left", maxWidth: 90 }
  )
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
    if (y > 260) {
      doc.addPage()
      y = 22
    }
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

function PhaseTimeline({ phase }: { phase: string }) {
  const currentIdx = timelineIndex(phase)
  return (
    <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/60 px-3 py-5 sm:px-5">
      <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Timeline de fases
      </p>
      <div className="flex items-center justify-between gap-0 overflow-x-auto pb-1">
        {TIMELINE.map((step, i) => {
          const past = i < currentIdx
          const current = i === currentIdx
          const future = i > currentIdx
          return (
            <div key={step.short} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 rounded-full",
                      past || current ? "bg-violet-500/70" : "bg-zinc-800"
                    )}
                  />
                )}
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[9px] font-bold",
                    past &&
                      "border-violet-500 bg-violet-500/20 text-violet-200",
                    current &&
                      "border-violet-400 bg-violet-500/30 text-white shadow-[0_0_16px_-4px_rgba(139,92,246,0.7)]",
                    future && "border-zinc-700 bg-zinc-900 text-zinc-600"
                  )}
                >
                  {past ? "✓" : current ? "●" : "○"}
                </div>
                {i < TIMELINE.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 rounded-full",
                      past ? "bg-violet-500/70" : "bg-zinc-800"
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  "max-w-[4.5rem] text-center text-[8px] font-medium uppercase leading-tight sm:text-[9px]",
                  current ? "text-violet-300" : past ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                {step.short}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type TabId = "progreso" | "particulares" | "entregables"

export function DirectorUserDetailView({
  email,
  onBack,
  onUserMissing,
}: {
  email: string
  onBack: () => void
  onUserMissing?: () => void
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [phaseUpdating, setPhaseUpdating] = useState(false)
  const [initClientLoading, setInitClientLoading] = useState(false)
  const [tab, setTab] = useState<TabId>("progreso")
  const [correctionFor, setCorrectionFor] = useState<{ slug: string; label: string } | null>(
    null
  )
  const [corrNote, setCorrNote] = useState("")
  const [corrLink, setCorrLink] = useState("")
  const [corrSaving, setCorrSaving] = useState(false)
  const [corrErr, setCorrErr] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/users/detail?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = (await res.json()) as UserDetail
        setDetail(data)
        return
      }
      if (res.status === 404) {
        onUserMissing?.()
        onBack()
        return
      }
      if (res.status === 401) {
        throw new Error("Sesión expirada o no autorizado.")
      }
      throw new Error(`Error al cargar (${res.status})`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar")
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [email, onBack, onUserMissing])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail])

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
    if (!detail) return
    setPhaseUpdating(true)
    try {
      const res = await apiFetch("/users/client-phase", {
        method: "PUT",
        body: JSON.stringify({ email, phase: newPhase }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        message?: string
      }
      if (res.ok && data.success !== false) {
        setDetail(prev =>
          prev
            ? {
                ...prev,
                client: prev.client ? { ...prev.client, phase: newPhase } : prev.client,
              }
            : prev
        )
      } else {
        alert(data.message || "No se pudo actualizar la fase.")
      }
    } catch {
      alert("Error de conexión al actualizar la fase.")
    }
    setPhaseUpdating(false)
  }

  const handleAdvancePhase = async () => {
    if (!detail?.client) return
    const next = getNextStoredPhase(detail.client.phase)
    if (!next) return
    await handlePhaseChange(next)
  }

  const handleInitClientRecord = async () => {
    if (!detail) return
    setInitClientLoading(true)
    try {
      const res = await apiFetch("/users/client-phase", {
        method: "PUT",
        body: JSON.stringify({ email, phase: "initial" }),
      })
      if (res.ok) await fetchDetail()
    } catch {
      /* ignore */
    } finally {
      setInitClientLoading(false)
    }
  }

  const handleSubmitDeliverableCorrection = async () => {
    if (!correctionFor) return
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
          student_email: email,
          task_slug: correctionFor.slug,
          director_note: note || undefined,
          director_link: link || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { detail?: string }
      if (!res.ok) {
        setCorrErr(typeof data.detail === "string" ? data.detail : "No se pudo enviar")
        return
      }
      setCorrectionFor(null)
      await fetchDetail()
    } catch {
      setCorrErr("Error de conexión")
    } finally {
      setCorrSaving(false)
    }
  }

  const nextPhase = detail?.client ? getNextStoredPhase(detail.client.phase) : null

  return (
    <div className="w-full max-w-5xl mx-auto pb-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-violet-500/40 hover:bg-zinc-900 hover:text-white"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Usuarios
        </button>
        {detail?.client && nextPhase && (
          <button
            type="button"
            disabled={phaseUpdating}
            onClick={() => void handleAdvancePhase()}
            className={DIRECTOR_TOOLBAR_BUTTON_CLASS}
          >
            Avanzar fase
            <ArrowRight aria-hidden />
          </button>
        )}
      </div>

      {loading && (
        <p className="py-12 text-center text-sm text-zinc-500">Cargando ficha…</p>
      )}
      {error && !loading && (
        <p className="py-12 text-center text-sm text-red-400">{error}</p>
      )}

      {!loading && !error && detail && (
        <>
          <div className="relative mb-8 overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-zinc-950 via-black to-zinc-950 p-6 shadow-[0_0_48px_-12px_rgba(88,28,135,0.35)] sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-violet-600/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {displayNameFromEmail(detail.email)}
                </h1>
                <p className="mt-1 truncate text-sm text-zinc-400">{detail.email}</p>
                {detail.client?.phone ? (
                  <p className="text-xs text-zinc-500">Celular: {detail.client.phone}</p>
                ) : null}
                {detail.client?.email && detail.client.email !== detail.email ? (
                  <p className="text-xs text-zinc-500">Email (cliente): {detail.client.email}</p>
                ) : null}
              </div>
              {detail.client && (
                <div className="flex flex-col gap-2 sm:items-end">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                    Cambiar fase
                  </span>
                  <Select
                    value={detail.client.phase}
                    onValueChange={v => void handlePhaseChange(v)}
                    disabled={phaseUpdating}
                  >
                    <SelectTrigger className="h-9 w-full min-w-[200px] border-zinc-700 bg-zinc-900/90 text-white sm:w-[240px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-700 bg-zinc-900 text-white">
                      {phaseSelectValues(detail.client.phase).map(p => (
                        <SelectItem key={p} value={p} className="focus:bg-zinc-800">
                          {phaseName(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {!detail.client && String(detail.role).includes("CLIENTE") && (
            <div className="mb-8 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-4">
              <p className="text-sm text-amber-200/90 mb-3">
                Este cliente no tiene ficha. Podés crearla para ver fase y tareas.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={initClientLoading}
                className="border-amber-800/60 bg-zinc-900 text-amber-100"
                onClick={() => void handleInitClientRecord()}
              >
                {initClientLoading ? "Creando…" : "Crear ficha de cliente"}
              </Button>
            </div>
          )}

          {detail.client && (
            <>
              <div className="mb-2 flex gap-1 border-b border-zinc-800">
                {(
                  [
                    ["progreso", "Progreso"],
                    ["particulares", "Tareas particulares"],
                    ["entregables", "Entregables"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={cn(
                      "relative px-4 py-3 text-sm font-medium transition-colors",
                      tab === id
                        ? "text-violet-300"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {label}
                    {tab === id && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-8">
                {tab === "progreso" && (
                  <>
                    <PhaseTimeline phase={detail.client.phase} />
                    <div>
                      <h3 className="mb-3 text-sm font-medium text-zinc-400">
                        Progreso de tareas (fase actual)
                      </h3>
                      <DirectorTaskProgress email={detail.email} phase={detail.client.phase} />
                    </div>
                  </>
                )}
                {tab === "particulares" && (
                  <DirectorParticularTasksList
                    email={detail.email}
                    phase={detail.client.phase}
                  />
                )}
                {tab === "entregables" && (
                  <DirectorDeliverablesGoogleGrid
                    entries={
                      detail.client.mandatory_task_deliverables
                        ? Object.entries(detail.client.mandatory_task_deliverables).map(
                            ([slug, row]) => ({ slug, row })
                          )
                        : []
                    }
                    onRequestCorrection={(slug, label) =>
                      setCorrectionFor({ slug, label })
                    }
                    onboardingCard={
                      detail.client.onboarding_responses &&
                      Object.keys(detail.client.onboarding_responses).length > 0
                        ? { onDownload: () => downloadOnboardingPdf(detail) }
                        : null
                    }
                  />
                )}
              </div>
            </>
          )}
        </>
      )}

      <Dialog
        open={!!correctionFor}
        onOpenChange={open => {
          if (!open) setCorrectionFor(null)
        }}
      >
        <DialogContent className="border-zinc-800 bg-zinc-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Corregir y reenviar al alumno</DialogTitle>
            <DialogDescription className="text-zinc-500 text-left">
              El alumno verá esto en su tarea y recibirá una notificación.
            </DialogDescription>
          </DialogHeader>
          {correctionFor ? (
            <p className="text-sm font-medium text-violet-200 uppercase tracking-wide -mt-1 mb-2">
              {correctionFor.label}
            </p>
          ) : null}
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="corr-note-du" className="text-zinc-300 text-xs">
                Comentario
              </Label>
              <Textarea
                id="corr-note-du"
                value={corrNote}
                onChange={e => setCorrNote(e.target.value)}
                rows={4}
                className="resize-y bg-zinc-900 border-zinc-700 text-white text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="corr-link-du" className="text-zinc-300 text-xs">
                Enlace (opcional)
              </Label>
              <Input
                id="corr-link-du"
                value={corrLink}
                onChange={e => setCorrLink(e.target.value)}
                className="h-10 bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
            {corrErr ? <p className="text-sm text-red-400">{corrErr}</p> : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-600 text-white"
              onClick={() => setCorrectionFor(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={corrSaving}
              className="bg-violet-600 hover:bg-violet-500 text-white"
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
