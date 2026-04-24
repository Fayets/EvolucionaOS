"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { downloadKpiReportsPdf, type KpiPdfTemplate } from "@/lib/kpi-export-pdf"
import { Eye, FileDown, Loader2, Trash2 } from "lucide-react"

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

type KpiReport = {
  id: number
  user_email: string
  user_name: string
  template_id: number
  week_start: string
  answers: Record<string, unknown>
  submitted_at: string
}

function formatKpiAnswerCell(raw: unknown): string {
  if (typeof raw === "boolean") return raw ? "Sí" : "No"
  if (raw == null || raw === "") return "—"
  return String(raw)
}

function ViewReportAnswersBody({ report, template }: { report: KpiReport; template: KpiTemplate | null }) {
  const answers = report.answers || {}
  if (!template?.fields?.length) {
    return (
      <p className="text-sm text-zinc-500">
        No se encontró la plantilla en el directorio o no tiene campos. Respuestas en bruto:{" "}
        <span className="font-mono text-xs text-zinc-400">{JSON.stringify(answers)}</span>
      </p>
    )
  }
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      {template.fields.map((f) => {
        const display = formatKpiAnswerCell(answers[f.id])
        return (
          <div
            key={f.id}
            className={cn(
              "border-b border-zinc-800 pb-3 last:border-0 last:pb-0 sm:border-0 sm:pb-0",
              f.type === "textarea" && "sm:col-span-2"
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{f.label}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{display}</p>
          </div>
        )
      })}
    </div>
  )
}

function mondayISOFromAnyDateInput(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function mondayThisWeek(): string {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const date = new Date(today)
  date.setDate(today.getDate() + diff)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

type ReportKindFilter = "all" | "mkt" | "ventas"

function templateNameMatchesReportKind(name: string, kind: ReportKindFilter): boolean {
  if (kind === "all") return true
  const n = name.toLowerCase()
  if (kind === "mkt") return n.includes("mkt") || n.includes("marketing")
  if (kind === "ventas") return n.includes("venta") || n.includes("sales")
  return true
}

export type DirectorKpiCardShellOptions = {
  cardClassName?: string
  contentClassName?: string
}

export function directorKpiCardShell(
  children: React.ReactNode,
  title: string,
  description?: string,
  options?: DirectorKpiCardShellOptions
) {
  return (
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-500/20 via-fuchsia-500/15 to-violet-500/20 blur-2xl opacity-50" />
      <Card
        className={cn(
          "relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-violet-500/15 bg-gradient-to-br from-zinc-950 via-black to-zinc-950",
          "text-white shadow-[0_0_48px_-12px_rgba(88,28,135,0.35)]",
          options?.cardClassName
        )}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-violet-600/10 blur-3xl" />
        <CardHeader className="relative shrink-0 border-b border-zinc-800/90 px-5 pb-3 pt-5 md:px-7">
          <CardTitle className="text-base font-semibold text-white md:text-lg">{title}</CardTitle>
          {description ? <CardDescription className="text-zinc-400">{description}</CardDescription> : null}
        </CardHeader>
        <CardContent
          className={cn("relative flex min-h-0 flex-1 flex-col px-5 pb-6 pt-4 md:px-7", options?.contentClassName)}
        >
          {children}
        </CardContent>
      </Card>
    </div>
  )
}

export function KpiReportsView() {
  const { accessToken } = useApp()
  const token = accessToken?.trim() || undefined

  const [weekFilter, setWeekFilter] = useState(mondayThisWeek)
  const [reportKindFilter, setReportKindFilter] = useState<ReportKindFilter>("all")
  const [reports, setReports] = useState<KpiReport[]>([])
  const [templates, setTemplates] = useState<KpiTemplate[]>([])
  const [clientTotal, setClientTotal] = useState(0)
  const [loadingReports, setLoadingReports] = useState(true)
  const [loadingMeta, setLoadingMeta] = useState(true)

  const [deleteTarget, setDeleteTarget] = useState<KpiReport | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [nameSearch, setNameSearch] = useState("")
  const [sendBulkOpen, setSendBulkOpen] = useState(false)
  const [viewReport, setViewReport] = useState<KpiReport | null>(null)

  const activeTemplate = useMemo(
    () => templates.find((t) => t.is_active) ?? null,
    [templates]
  )

  const templateNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const t of templates) {
      m.set(t.id, t.name)
    }
    return m
  }, [templates])

  const weekStartQuery = useMemo(() => mondayISOFromAnyDateInput(weekFilter), [weekFilter])

  const refreshTemplates = useCallback(async () => {
    if (!token) return
    const res = await apiFetch("/kpi/templates", { bearerToken: token })
    if (!res.ok) return
    const data = (await res.json()) as KpiTemplate[]
    setTemplates(Array.isArray(data) ? data : [])
  }, [token])

  const refreshReports = useCallback(async () => {
    if (!token) return
    setLoadingReports(true)
    try {
      const params = new URLSearchParams()
      params.set("week_start", weekStartQuery)
      const res = await apiFetch(`/kpi/reports?${params}`, { bearerToken: token })
      if (!res.ok) {
        setReports([])
        return
      }
      const data = (await res.json()) as KpiReport[]
      setReports(Array.isArray(data) ? data : [])
    } finally {
      setLoadingReports(false)
    }
  }, [token, weekStartQuery])

  /** Solo necesitamos `total`; `count` ≤ 100 en API (422 si se pasa 200). */
  const refreshClientTotal = useCallback(async () => {
    if (!token) return
    const params = new URLSearchParams({
      role: "CLIENTE",
      page: "1",
      count: "1",
      sort: "email",
      order: "asc",
    })
    const res = await apiFetch(`/users?${params}`, { bearerToken: token })
    if (!res.ok) return
    const data = (await res.json()) as { users?: unknown[]; total?: number }
    const rows = Array.isArray(data.users) ? data.users : []
    setClientTotal(typeof data.total === "number" ? data.total : rows.length)
  }, [token])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoadingMeta(true)
      await Promise.all([refreshTemplates(), refreshClientTotal()])
      if (!cancelled) setLoadingMeta(false)
    })()
    return () => {
      cancelled = true
    }
  }, [token, refreshTemplates, refreshClientTotal])

  useEffect(() => {
    void refreshReports()
  }, [refreshReports])

  const submittedThisWeek = reports.length

  const filteredReports = useMemo(() => {
    let rows = reports
    if (reportKindFilter !== "all") {
      rows = rows.filter((r) => {
        const tplName = templateNameById.get(r.template_id) ?? ""
        return templateNameMatchesReportKind(tplName, reportKindFilter)
      })
    }
    const q = nameSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const email = (r.user_email || "").toLowerCase()
      const name = (r.user_name || "").toLowerCase()
      return email.includes(q) || name.includes(q)
    })
  }, [reports, nameSearch, reportKindFilter, templateNameById])

  const pdfTemplates = useMemo((): KpiPdfTemplate[] => templates as KpiPdfTemplate[], [templates])

  const exportPdf = () => {
    if (!reports.length) return
    downloadKpiReportsPdf({
      reports,
      templates: pdfTemplates,
      activeTemplate,
    })
  }

  const exportPdfOne = (r: KpiReport) => {
    downloadKpiReportsPdf({
      reports: [r],
      templates: pdfTemplates,
      activeTemplate,
    })
  }

  const confirmDeleteReport = async () => {
    if (!token || !deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await apiFetch(`/kpi/reports/${deleteTarget.id}`, {
        method: "DELETE",
        bearerToken: token,
      })
      if (!res.ok) return
      setDeleteTarget(null)
      await refreshReports()
    } finally {
      setDeleteLoading(false)
    }
  }

  const templateLabel = (templateId: number) =>
    templates.find((t) => t.id === templateId)?.name ?? `Plantilla #${templateId}`

  const templateForReport = (r: KpiReport) => templates.find((t) => t.id === r.template_id) ?? null

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-2 pb-4 sm:px-3 lg:px-4">
      {directorKpiCardShell(
        <>
          <div className="flex shrink-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between xl:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className="text-sm text-zinc-400">
                {loadingMeta ? "…" : `${submittedThisWeek} / ${clientTotal} clientes enviaron esta semana`}
                {nameSearch.trim() || reportKindFilter !== "all" ? (
                  <span className="ml-2 text-zinc-500">
                    · Mostrando {filteredReports.length} de {reports.length}
                  </span>
                ) : null}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-0 flex-1 space-y-1 sm:min-w-[200px] sm:max-w-md">
                  <Label className="text-xs text-zinc-500" htmlFor="kpi-report-search">
                    Buscar por nombre o email
                  </Label>
                  <Input
                    id="kpi-report-search"
                    type="search"
                    value={nameSearch}
                    onChange={(e) => setNameSearch(e.target.value)}
                    placeholder="Ej. María o @dominio.com"
                    className="border-zinc-700 bg-black/50 text-white placeholder:text-zinc-600"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-500">Semana (lunes)</Label>
                  <Input
                    type="date"
                    value={weekFilter}
                    onChange={(e) => setWeekFilter(mondayISOFromAnyDateInput(e.target.value))}
                    className="w-[160px] border-zinc-700 bg-black/50 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-500">Reporte</Label>
                  <Select
                    value={reportKindFilter}
                    onValueChange={(v) => setReportKindFilter(v as ReportKindFilter)}
                  >
                    <SelectTrigger className="w-[220px] border-zinc-700 bg-black/50 text-white">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-950 text-white">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="mkt">Marketing</SelectItem>
                      <SelectItem value="ventas">Ventas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="border border-zinc-600 bg-zinc-800/80 text-zinc-100 hover:bg-zinc-700"
                onClick={() => setSendBulkOpen(true)}
              >
                Enviar reportes a todos los usuarios
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loadingReports || reports.length === 0}
                className="border border-violet-500/30 bg-violet-950/40 text-violet-100 hover:bg-violet-900/50 disabled:opacity-50"
                onClick={() => exportPdf()}
              >
                Exportar PDF
              </Button>
            </div>
          </div>
          <div className="mt-4 flex min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-800/80">
            {loadingReports ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-8 animate-spin text-violet-400" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="min-w-[200px] text-zinc-300">Cliente</TableHead>
                    <TableHead className="min-w-[100px] text-zinc-300">Formulario</TableHead>
                    <TableHead className="text-zinc-300">Semana</TableHead>
                    <TableHead className="text-zinc-300">Fecha envío</TableHead>
                    <TableHead className="w-[132px] min-w-[132px] text-right text-zinc-300">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.length === 0 ? (
                    <TableRow className="border-zinc-800">
                      <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                        {reports.length === 0
                          ? "No hay reportes para los filtros seleccionados."
                          : reportKindFilter !== "all" && !nameSearch.trim()
                            ? "Ningún reporte coincide con el filtro seleccionado para la semana."
                            : "Ningún resultado coincide con la búsqueda o el tipo de reporte."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReports.map((r) => (
                      <TableRow key={r.id} className="border-zinc-800">
                        <TableCell className="text-zinc-200">
                          <span className="block font-medium">{r.user_name?.trim() || "—"}</span>
                          <span className="block text-xs text-zinc-500">{r.user_email}</span>
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-sm text-violet-200/90">
                          {templateNameById.get(r.template_id) ?? `#${r.template_id}`}
                        </TableCell>
                        <TableCell className="text-zinc-400">{r.week_start}</TableCell>
                        <TableCell className="text-zinc-400 text-xs">
                          {new Date(r.submitted_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-9 text-zinc-400 hover:bg-zinc-800 hover:text-violet-200"
                              title="Descargar PDF de este envío"
                              aria-label={`Descargar PDF de ${r.user_email}`}
                              onClick={() => exportPdfOne(r)}
                            >
                              <FileDown className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-9 text-zinc-400 hover:bg-zinc-800 hover:text-violet-200"
                              title="Ver formulario"
                              aria-label={`Ver formulario de ${r.user_email}`}
                              onClick={() => setViewReport(r)}
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-9 text-zinc-400 hover:bg-red-950/40 hover:text-red-400"
                              title="Eliminar reporte"
                              aria-label={`Eliminar reporte de ${r.user_email}`}
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </>,
        "Reportes semanales",
        "Listado de envíos por semana, búsqueda por nombre o email y exportación a PDF.",
        { contentClassName: "pt-4 pb-5 md:pb-6" }
      )}

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeleteTarget(null)
        }}
      >
        <DialogContent className="border-zinc-800 bg-zinc-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar reporte</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {deleteTarget ? (
                <>
                  Se va a borrar de forma permanente el envío de{" "}
                  <span className="text-zinc-200">{deleteTarget.user_email}</span> (
                  {templateLabel(deleteTarget.template_id)}, semana {deleteTarget.week_start}). Esta acción no se puede
                  deshacer.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" disabled={deleteLoading} onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteLoading}
              onClick={() => void confirmDeleteReport()}
            >
              {deleteLoading ? <Loader2 className="size-4 animate-spin" /> : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewReport != null}
        onOpenChange={(open) => {
          if (!open) setViewReport(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Respuestas del formulario</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {viewReport ? (
                <>
                  <span className="text-zinc-200">{viewReport.user_name?.trim() || "—"}</span> ·{" "}
                  {viewReport.user_email} · {templateLabel(viewReport.template_id)} · semana {viewReport.week_start}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {viewReport ? <ViewReportAnswersBody report={viewReport} template={templateForReport(viewReport)} /> : null}
          <DialogFooter>
            <Button type="button" className="bg-zinc-100 text-zinc-900 hover:bg-white" onClick={() => setViewReport(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendBulkOpen} onOpenChange={setSendBulkOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar reportes a todos los usuarios</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Acá se conectará la automatización para recordar o solicitar el reporte semanal a todos los clientes
              (email, notificación u otro canal). Por ahora es solo un marcador de lugar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" className="bg-zinc-100 text-zinc-900 hover:bg-white" onClick={() => setSendBulkOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
