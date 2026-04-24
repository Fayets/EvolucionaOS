"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"

type KpiField = {
  id: string
  label: string
  type: string
  required: boolean
  options?: string[] | null
}

type KpiTemplate = {
  id: number
  name: string
  fields: KpiField[]
  is_active: boolean
  created_at: string
}

const TYPE_OPTIONS: { value: KpiField["type"]; label: string }[] = [
  { value: "text", label: "Texto corto" },
  { value: "number", label: "Número" },
  { value: "textarea", label: "Texto largo" },
  { value: "select", label: "Selección" },
  { value: "boolean", label: "Sí/No" },
]

function newFieldId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

type Props = {
  mode: "new" | "edit"
  templateId?: number
}

export function KpiTemplateEditorPage({ mode, templateId }: Props) {
  const router = useRouter()
  const { isLoggedIn, userRole, accessToken } = useApp()
  const token = accessToken?.trim() || undefined

  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingTpl, setLoadingTpl] = useState(mode === "edit")
  const [tplName, setTplName] = useState("")
  const [tplFields, setTplFields] = useState<KpiField[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [savingTpl, setSavingTpl] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace("/")
      return
    }
    if (userRole !== "director") {
      router.replace("/")
    }
  }, [isLoggedIn, userRole, router])

  const loadTemplate = useCallback(async () => {
    if (!token || mode !== "edit" || templateId == null) return
    setLoadingTpl(true)
    setLoadError(null)
    try {
      const res = await apiFetch("/kpi/templates", { bearerToken: token })
      if (!res.ok) {
        setLoadError("No se pudieron cargar las plantillas.")
        return
      }
      const list = (await res.json()) as KpiTemplate[]
      const t = Array.isArray(list) ? list.find((x) => x.id === templateId) : undefined
      if (!t) {
        setLoadError("Plantilla no encontrada.")
        return
      }
      setEditingId(t.id)
      setTplName(t.name)
      setTplFields(
        (t.fields || []).length
          ? t.fields.map((f) => ({ ...f, options: f.options ?? null }))
          : [{ id: newFieldId(), label: "Campo", type: "text", required: false, options: null }]
      )
    } finally {
      setLoadingTpl(false)
    }
  }, [token, mode, templateId])

  useEffect(() => {
    if (mode === "new") {
      setEditingId(null)
      setTplName("")
      setTplFields([{ id: newFieldId(), label: "Nuevo campo", type: "text", required: false, options: null }])
      setLoadingTpl(false)
      return
    }
    void loadTemplate()
  }, [mode, loadTemplate])

  const updateField = (index: number, patch: Partial<KpiField>) => {
    setTplFields((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      if (patch.type && patch.type !== "select") {
        next[index].options = null
      }
      return next
    })
  }

  const goBack = () => {
    router.push("/?view=kpi-formularios")
  }

  const saveTemplate = async () => {
    if (!token) return
    setSavingTpl(true)
    try {
      const body = JSON.stringify({ name: tplName.trim(), fields: tplFields })
      const url = editingId != null ? `/kpi/templates/${editingId}` : "/kpi/templates"
      const res = await apiFetch(url, {
        method: editingId != null ? "PUT" : "POST",
        bearerToken: token,
        body,
      })
      if (!res.ok) return
      goBack()
    } finally {
      setSavingTpl(false)
    }
  }

  if (!isLoggedIn || userRole !== "director") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black text-zinc-500">
        <Loader2 className="size-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (loadingTpl) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black text-zinc-400">
        <Loader2 className="size-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 bg-black px-4 text-center">
        <p className="text-red-400">{loadError}</p>
        <Button asChild variant="outline" className="border-zinc-600 text-white">
          <Link href="/?view=kpi-formularios">Volver a formularios</Link>
        </Button>
      </div>
    )
  }

  const title = mode === "new" ? "Nueva plantilla KPI" : "Editar plantilla KPI"

  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="pointer-events-none fixed inset-0 opacity-[0.04]" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "128px 128px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-10 flex flex-col gap-4 border-b border-zinc-800/90 pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-2 border-zinc-600 bg-zinc-950 text-zinc-200 hover:bg-zinc-900"
              onClick={goBack}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Volver a KPIs
            </Button>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
          </div>
          <p className="max-w-md text-sm text-zinc-500">
            Los cambios se guardan en el servidor. Solo una plantilla puede estar activa a la vez.
          </p>
        </div>

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_min(380px,100%)] xl:items-start">
          <div className="flex min-w-0 flex-col gap-10">
            <div className="space-y-3">
              <Label htmlFor="tpl-name" className="text-sm font-medium text-zinc-200">
                Nombre de la plantilla
              </Label>
              <Input
                id="tpl-name"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                className="h-12 max-w-xl border-zinc-600 bg-zinc-950/90 text-base text-white"
                placeholder="Ej. KPIs Venta"
              />
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Campos del formulario</h2>
                  <p className="mt-1 text-xs text-zinc-500">Cada bloque es una pregunta que verá el cliente.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 border-violet-500/40 bg-violet-950/30 text-violet-100 hover:bg-violet-900/40"
                  onClick={() =>
                    setTplFields((prev) => [
                      ...prev,
                      { id: newFieldId(), label: "Nuevo campo", type: "text", required: false, options: null },
                    ])
                  }
                >
                  <Plus className="mr-2 size-4" />
                  Agregar campo
                </Button>
              </div>

              <div className="flex flex-col gap-6">
                {tplFields.map((f, idx) => (
                  <div
                    key={f.id}
                    className="rounded-2xl border border-zinc-700/80 bg-zinc-950/60 p-5 sm:p-6 md:p-8"
                  >
                    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
                      <div className="space-y-2">
                        <Label className="text-sm text-zinc-300">Etiqueta visible</Label>
                        <Input
                          value={f.label}
                          onChange={(e) => updateField(idx, { label: e.target.value })}
                          className="h-11 border-zinc-600 bg-black/50 text-base text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-zinc-300">Tipo de respuesta</Label>
                        <Select
                          value={f.type}
                          onValueChange={(v) => updateField(idx, { type: v as KpiField["type"] })}
                        >
                          <SelectTrigger className="h-11 w-full border-zinc-600 bg-black/50 text-base text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-zinc-800 bg-zinc-950 text-white">
                            {TYPE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {f.type === "select" ? (
                      <div className="mt-6 space-y-2">
                        <Label className="text-sm text-zinc-300">Opciones (separadas por coma)</Label>
                        <Input
                          value={(f.options || []).join(", ")}
                          onChange={(e) =>
                            updateField(idx, {
                              options: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          className="h-11 border-zinc-600 bg-black/50 text-base text-white"
                          placeholder="Opción A, Opción B, Opción C"
                        />
                      </div>
                    ) : null}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800/80 pt-6">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={f.required}
                          onCheckedChange={(c) => updateField(idx, { required: c })}
                          className="data-[state=checked]:bg-violet-600"
                        />
                        <span className="text-sm text-zinc-300">Campo obligatorio</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-zinc-500 hover:bg-red-950/40 hover:text-red-300"
                        onClick={() => setTplFields((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Quitar campo
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-violet-500/25 bg-gradient-to-b from-violet-950/30 to-black/40 p-6 sm:p-8 xl:sticky xl:top-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">Vista previa</p>
            <p className="mt-1 text-xs text-zinc-500">Así se verá el formulario público (solo lectura).</p>
            <div className="mt-6 max-h-[70vh] space-y-5 overflow-y-auto pr-1">
              {tplFields.map((f) => (
                <div key={f.id} className="space-y-2">
                  <Label className="text-sm text-zinc-300">
                    {f.label}
                    {f.required ? <span className="text-red-400"> *</span> : null}
                  </Label>
                  {f.type === "textarea" ? (
                    <Textarea readOnly className="min-h-[88px] border-zinc-700 bg-black/50 text-sm text-zinc-500" placeholder="…" />
                  ) : f.type === "number" ? (
                    <Input readOnly type="number" className="h-11 border-zinc-700 bg-black/50 text-zinc-500" placeholder="0" />
                  ) : f.type === "select" ? (
                    <Select disabled>
                      <SelectTrigger className="h-11 border-zinc-700 bg-black/50 text-zinc-500">
                        <SelectValue placeholder="Elegir…" />
                      </SelectTrigger>
                    </Select>
                  ) : f.type === "boolean" ? (
                    <div className="flex items-center gap-3 opacity-70">
                      <Switch disabled checked={false} />
                      <span className="text-sm text-zinc-500">No</span>
                    </div>
                  ) : (
                    <Input readOnly className="h-11 border-zinc-700 bg-black/50 text-zinc-500" placeholder="Texto" />
                  )}
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-12 flex flex-col-reverse gap-3 border-t border-zinc-800 pt-10 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" className="text-zinc-400 hover:text-white" onClick={goBack}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={savingTpl || !tplName.trim()}
            className="min-w-[180px] bg-violet-600 text-white hover:bg-violet-500"
            onClick={() => void saveTemplate()}
          >
            {savingTpl ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Guardando…
              </span>
            ) : (
              "Guardar plantilla"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
