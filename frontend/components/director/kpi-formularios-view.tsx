"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus } from "lucide-react"
import { directorKpiCardShell } from "./kpi-reports-view"

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

export function KpiFormulariosView() {
  const { accessToken } = useApp()
  const token = accessToken?.trim() || undefined

  const [templates, setTemplates] = useState<KpiTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const refreshTemplates = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await apiFetch("/kpi/templates", { bearerToken: token })
      if (!res.ok) return
      const data = (await res.json()) as KpiTemplate[]
      setTemplates(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refreshTemplates()
  }, [refreshTemplates])

  const activateTemplate = async (id: number) => {
    if (!token) return
    const res = await apiFetch(`/kpi/templates/${id}/activate`, {
      method: "PATCH",
      bearerToken: token,
    })
    if (!res.ok) return
    await refreshTemplates()
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-10">
      {directorKpiCardShell(
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-400">
              Gestioná las plantillas que usan los reportes semanales públicos (Venta y Mkt).
            </p>
            <Button type="button" size="sm" className="shrink-0 gap-1 bg-violet-600 text-white hover:bg-violet-500" asChild>
              <Link href="/kpi-plantillas/nueva">
                <Plus className="size-4" />
                Nuevo template
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-violet-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-800/90 bg-black/35 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white">{t.name}</p>
                    <p className="text-xs text-zinc-500">
                      {(t.fields || []).length} campo(s) · creado {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant={t.is_active ? "default" : "secondary"}>
                      {t.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                    {!t.is_active ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void activateTemplate(t.id)}>
                        Activar
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="ghost" className="text-zinc-200 hover:text-white" asChild>
                      <Link href={`/kpi-plantillas/${t.id}`}>Editar</Link>
                    </Button>
                  </div>
                </div>
              ))}
              {templates.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">No hay plantillas. Creá una nueva.</p>
              ) : null}
            </div>
          )}
        </div>,
        "Formularios KPI",
        "Definí campos, activá la versión que quieras exponer y editá desde la vista dedicada."
      )}
    </div>
  )
}
