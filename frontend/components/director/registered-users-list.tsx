"use client"

import { useState, useEffect, useCallback } from "react"
import { jsPDF } from "jspdf"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Check, Circle } from "lucide-react"

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
  "done",
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
  platforms: "Accesos a plataformas",
  done: "Programa completado",
  tasks: "Acceso",
  onboarding: "Onboarding",
}

function phaseName(phase: string): string {
  return phaseLabel[phase] ?? phase
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
                <span className={`text-[13px] ${done ? "text-zinc-400 line-through" : "text-zinc-300"}`}>
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
              <span className={`text-[13px] ${t.completed ? "text-zinc-400 line-through" : "text-zinc-300"}`}>
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

export function RegisteredUsersList() {
  const { users, removeUser, listLoading, listFetchFailed, refreshFromServer } =
    useRegisteredUsers()
  const [viewEmail, setViewEmail] = useState<string | null>(null)
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [phaseUpdating, setPhaseUpdating] = useState(false)
  const [initClientLoading, setInitClientLoading] = useState(false)

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

  const handlePhaseChange = async (newPhase: string) => {
    if (!detail || !viewEmail) return
    setPhaseUpdating(true)
    try {
      const res = await apiFetch("/users/client-phase", {
        method: "PUT",
        body: JSON.stringify({ email: viewEmail, phase: newPhase }),
      })
      if (res.ok) {
        setDetail(prev => prev ? {
          ...prev,
          client: prev.client ? { ...prev.client, phase: newPhase } : prev.client,
        } : prev)
      }
    } catch {}
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

  const handleQuitar = async (user: { id: string; username: string }) => {
    try {
      await apiFetch(`/users/by-email?email=${encodeURIComponent(user.username)}`, { method: "DELETE" })
    } catch {}
    removeUser(user.id)
    if (viewEmail === user.username) setViewEmail(null)
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
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
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-800">
              {users.map(user => (
                <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
                  <div>
                    <p className="font-medium text-white">{user.username}</p>
                    <p className="text-xs text-zinc-500">
                      Alta:{" "}
                      {new Date(user.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" className="text-zinc-300 hover:text-white hover:bg-zinc-800" onClick={() => setViewEmail(user.username)}>
                      Ver
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-zinc-400 hover:text-red-400 hover:bg-zinc-900" onClick={() => handleQuitar(user)}>
                      Quitar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
    </div>
  )
}
