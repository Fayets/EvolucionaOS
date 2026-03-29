"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { apiFetch } from "@/lib/api"
import { CLIENT_PHASES } from "@/lib/phases"

interface MandatoryTaskItem {
  id: number
  slug: string
  label: string
  link_url: string
  deliverable_links?: string[]
  order: number | null
  phase: string
}

type PhaseDialogState =
  | { kind: "closed" }
  | { kind: "add"; phase: string }
  | { kind: "edit"; task: MandatoryTaskItem }

function groupByPhase(tasks: MandatoryTaskItem[]): Record<string, MandatoryTaskItem[]> {
  const map: Record<string, MandatoryTaskItem[]> = {}
  for (const p of CLIENT_PHASES) map[p] = []
  for (const t of tasks) {
    if (map[t.phase] !== undefined) {
      map[t.phase].push(t)
      continue
    }
    const k = "_otras"
    if (!map[k]) map[k] = []
    map[k].push(t)
  }
  for (const p of CLIENT_PHASES) {
    map[p].sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) || a.id - b.id
    )
  }
  if (map._otras) {
    map._otras.sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) || a.id - b.id
    )
  }
  return map
}

function linesToUrls(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
}

function formatApiError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>
    if (typeof o.detail === "string") return o.detail
    if (Array.isArray(o.detail)) {
      const parts = o.detail
        .map((x) =>
          typeof x === "object" && x !== null && "msg" in x
            ? String((x as { msg: string }).msg)
            : ""
        )
        .filter(Boolean)
      if (parts.length) return parts.join(", ")
    }
    if (typeof o.message === "string") return o.message
  }
  return `Error ${status}`
}

export function DirectorPhases() {
  const [allTasks, setAllTasks] = useState<MandatoryTaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<PhaseDialogState>({ kind: "closed" })
  const [formLabel, setFormLabel] = useState("")
  const [formLinkClass, setFormLinkClass] = useState("")
  const [formDeliverables, setFormDeliverables] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch("/mandatory-tasks")
      if (res.ok) {
        const data = (await res.json()) as MandatoryTaskItem[]
        setAllTasks(Array.isArray(data) ? data : [])
      } else {
        setAllTasks([])
      }
    } catch {
      setAllTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (dialog.kind === "edit") {
      const t = dialog.task
      setFormLabel(t.label.toUpperCase())
      setFormLinkClass(t.link_url || "")
      setFormDeliverables((t.deliverable_links ?? []).join("\n"))
    } else if (dialog.kind === "add") {
      setFormLabel("")
      setFormLinkClass("")
      setFormDeliverables("")
    }
  }, [dialog])

  const byPhase = groupByPhase(allTasks)

  const handleSaveAdd = async () => {
    if (dialog.kind !== "add") return
    const label = formLabel.trim().toUpperCase()
    if (!label) return
    const deliverable_links = linesToUrls(formDeliverables)
    setSaving(true)
    try {
      const res = await apiFetch("/mandatory-tasks", {
        method: "POST",
        body: JSON.stringify({
          label,
          link_url: formLinkClass.trim() || undefined,
          deliverable_links,
          phase: dialog.phase,
        }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        alert(formatApiError(body, res.status))
        return
      }
      if (
        body &&
        typeof body === "object" &&
        "success" in body &&
        (body as { success: boolean }).success === false
      ) {
        const msg = (body as { message?: unknown }).message
        alert(typeof msg === "string" ? msg : "No se pudo crear la tarea.")
        return
      }
      setDialog({ kind: "closed" })
      await fetchAll()
    } catch {
      alert("Error de conexión al crear la tarea.")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (dialog.kind !== "edit") return
    const label = formLabel.trim().toUpperCase()
    if (!label) return
    const deliverable_links = linesToUrls(formDeliverables)
    setSaving(true)
    try {
      const res = await apiFetch(`/mandatory-tasks/${dialog.task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          label,
          link_url: formLinkClass.trim() ? formLinkClass.trim() : null,
          deliverable_links,
        }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        alert(formatApiError(body, res.status))
        return
      }
      if (
        body &&
        typeof body === "object" &&
        "success" in body &&
        (body as { success: boolean }).success === false
      ) {
        const msg = (body as { message?: unknown }).message
        alert(typeof msg === "string" ? msg : "No se pudo guardar la tarea.")
        return
      }
      setDialog({ kind: "closed" })
      await fetchAll()
    } catch {
      alert("Error de conexión al guardar la tarea.")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("¿Quitar esta tarea de la fase?")) return
    try {
      const res = await apiFetch(`/mandatory-tasks/${taskId}`, { method: "DELETE" })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        alert(formatApiError(body, res.status))
        return
      }
      setDialog({ kind: "closed" })
      await fetchAll()
    } catch {
      alert("Error de conexión al eliminar")
    }
  }

  const phaseCard = (phase: string, title: string, allowAdd = true) => {
    const tasks = byPhase[phase] ?? []

    return (
      <Card
        key={phase}
        className="relative border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)] flex flex-col"
      >
        <CardHeader className="pb-2 border-b border-zinc-800 px-4 md:px-5">
          <div className="flex flex-row items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="inline-flex max-w-fit rounded bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-black">
                {title}
              </p>
            </div>
            {allowAdd ? (
              <Button
                type="button"
                className="h-9 shrink-0 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full border-0 text-sm"
                onClick={() => setDialog({ kind: "add", phase })}
              >
                Agregar tarea
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-4 md:px-5 pb-5 flex flex-col flex-1 gap-2">
          {tasks.length === 0 ? (
            <p className="text-xs text-zinc-600 py-2">Ninguna tarea aún.</p>
          ) : (
            <ul className="space-y-2 flex-1 min-h-[2rem] list-none p-0 m-0">
              {tasks.map((task) => {
                const hasClass = Boolean(task.link_url?.trim())
                const extras = (task.deliverable_links ?? []).filter(Boolean).length
                const hintParts: string[] = []
                if (hasClass) hintParts.push("Clase")
                if (extras > 0) hintParts.push(`${extras} entregable${extras === 1 ? "" : "s"}`)
                const hint = hintParts.length > 0 ? hintParts.join(" · ") : "Solo nombre"
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "edit", task })}
                      className="w-full flex items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-3 text-left transition-colors hover:bg-zinc-800/80 hover:border-zinc-600"
                    >
                      <span className="text-sm text-zinc-100 leading-snug min-w-0 uppercase">
                        {task.label}
                        <span className="block text-[11px] text-zinc-500 font-normal mt-0.5 normal-case">
                          {hint}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-zinc-500 shrink-0" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {!allowAdd ? (
            <p className="text-[11px] text-zinc-600 pt-2">
              Tareas con fase antigua en la base: abrí cada una para editar o eliminar.
            </p>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  const dialogOpen = dialog.kind !== "closed"
  const dialogTitle =
    dialog.kind === "add"
      ? `Nueva tarea · ${dialog.phase}`
      : dialog.kind === "edit"
        ? "Editar tarea"
        : ""

  return (
    <div className="w-full max-w-7xl mx-auto px-1 md:px-2 pb-8">
      <h1 className="text-2xl font-semibold text-white mb-2">Fases</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Gestioná las tareas predeterminadas por fase del programa. Podés crear, editar y quitar desde cada ítem.
      </p>

      {loading ? (
        <div className="w-full flex items-center justify-center py-16">
          <p className="text-zinc-500">Cargando fases y tareas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
          {CLIENT_PHASES.map((p) => phaseCard(p, p, true))}
          {byPhase._otras?.length ? (
            <div className="md:col-span-2 xl:col-span-3">
              {phaseCard("_otras", "Otras / legacy (antiguas en BD)", false)}
            </div>
          ) : null}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" })
        }}
      >
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Solo el nombre es obligatorio. Podés dejar vacío el link de clase, los entregables o ambos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="task-name" className="text-zinc-300 text-xs">
                Nombre
              </Label>
              <Input
                id="task-name"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value.toUpperCase())}
                placeholder="EJ: VER VIDEO ONBOARDING"
                autoCapitalize="characters"
                className="h-10 bg-zinc-900 border-zinc-700 text-white uppercase"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="task-class-link" className="text-zinc-300 text-xs">
                Link de clase <span className="text-zinc-500 font-normal">(opcional)</span>
              </Label>
              <Input
                id="task-class-link"
                value={formLinkClass}
                onChange={(e) => setFormLinkClass(e.target.value)}
                placeholder="https://..."
                type="text"
                inputMode="url"
                autoComplete="url"
                className="h-10 bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="task-deliverables" className="text-zinc-300 text-xs">
                Links de entregables <span className="text-zinc-500 font-normal">(opcional, uno por línea)</span>
              </Label>
              <Textarea
                id="task-deliverables"
                value={formDeliverables}
                onChange={(e) => setFormDeliverables(e.target.value)}
                placeholder={"https://...\nhttps://..."}
                rows={5}
                className="resize-y min-h-[100px] bg-zinc-900 border-zinc-700 text-white text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row sm:justify-between">
            {dialog.kind === "edit" ? (
              <Button
                type="button"
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-950/40 mr-auto"
                onClick={() => void handleDeleteTask(dialog.task.id)}
              >
                Eliminar
              </Button>
            ) : (
              <span className="hidden sm:inline mr-auto" />
            )}
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-600 text-white bg-transparent"
                onClick={() => setDialog({ kind: "closed" })}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={saving || !formLabel.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-full border-0"
                onClick={() =>
                  void (dialog.kind === "add" ? handleSaveAdd() : handleSaveEdit())
                }
              >
                {saving ? "Guardando…" : dialog.kind === "add" ? "Crear" : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
