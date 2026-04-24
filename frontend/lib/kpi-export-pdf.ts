import { jsPDF } from "jspdf"
import { addDays, format } from "date-fns"
import { es } from "date-fns/locale"

export type KpiPdfField = { id: string; label: string }
export type KpiPdfReport = {
  user_email: string
  user_name: string
  week_start: string
  answers: Record<string, unknown>
  template_id: number
}
export type KpiPdfTemplate = { id: number; name: string; fields: KpiPdfField[] }

const ORANGE: [number, number, number] = [234, 125, 42]

function parseLocalDate(isoYmd: string): Date {
  const [y, m, d] = isoYmd.split("-").map((x) => parseInt(x, 10))
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d, 12, 0, 0)
}

function weekNumberInMonth(weekMonday: Date): number {
  const y = weekMonday.getFullYear()
  const mo = weekMonday.getMonth()
  const first = new Date(y, mo, 1, 12, 0, 0)
  const dow = first.getDay()
  const fromMon = dow === 0 ? 6 : dow - 1
  const gridStart = new Date(y, mo, 1 - fromMon, 12, 0, 0)
  const diffDays = Math.round((weekMonday.getTime() - gridStart.getTime()) / 86400000)
  return Math.floor(diffDays / 7) + 1
}

function weekLabelEs(weekStartIso: string): string {
  const monday = parseLocalDate(weekStartIso)
  const sunday = addDays(monday, 6)
  const n = weekNumberInMonth(monday)
  const monthName = format(monday, "MMMM", { locale: es })
  const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1)
  return `${n}ª semana del mes (${cap} ${monday.getFullYear()}) — del ${format(monday, "d/M/yyyy")} al ${format(sunday, "d/M/yyyy")}`
}

function fmtCell(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—"
  if (typeof v === "boolean") return v ? "Sí" : "No"
  return String(v)
}

function resolveTemplate(
  report: KpiPdfReport,
  templates: KpiPdfTemplate[],
  active: KpiPdfTemplate | null
): KpiPdfTemplate | null {
  return templates.find((t) => t.id === report.template_id) ?? active
}

function drawTableHeader(doc: jsPDF, M: number, y: number, colW: number[], headers: string[]) {
  let x = M
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  const headerH = 8
  for (let c = 0; c < headers.length; c++) {
    doc.setFillColor(...ORANGE)
    doc.setDrawColor(20, 20, 20)
    doc.rect(x, y, colW[c], headerH, "FD")
    doc.setTextColor(255, 255, 255)
    doc.text(headers[c], x + 1.5, y + 5.5)
    x += colW[c]
  }
}

export function downloadKpiReportsPdf(opts: {
  reports: KpiPdfReport[]
  templates: KpiPdfTemplate[]
  activeTemplate: KpiPdfTemplate | null
}): void {
  const { reports, templates, activeTemplate } = opts
  if (!reports.length) return

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true })
  const W = doc.internal.pageSize.getWidth()
  const M = 12
  const innerW = W - 2 * M
  const colW = [innerW * 0.4, innerW * 0.6]
  const headers = ["Métricas", "Valor"]
  const yMax = 285
  const titleBarH = 10
  const gapBelowTitle = 7

  reports.forEach((r, reportIdx) => {
    if (reportIdx > 0) doc.addPage()

    const tpl = resolveTemplate(r, templates, activeTemplate)
    const fields = tpl?.fields ?? []
    const title = tpl?.name || "Métricas"

    let y = M

    doc.setFillColor(...ORANGE)
    doc.setDrawColor(20, 20, 20)
    doc.rect(M, y, innerW, titleBarH, "FD")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(title, M + 2, y + 7)
    y += titleBarH + gapBelowTitle

    doc.setTextColor(0, 0, 0)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    const namePart = r.user_name?.trim() ? `${r.user_name} · ` : ""
    doc.text(`Cliente: ${namePart}${r.user_email}`, M, y)
    y += 6
    doc.setFontSize(9.5)
    doc.text(`Semana del mes: ${weekLabelEs(r.week_start)}`, M, y)
    y += 9

    drawTableHeader(doc, M, y, colW, headers)
    y += 8

    doc.setFont("helvetica", "normal")
    doc.setDrawColor(20, 20, 20)

    const drawRow = (f: KpiPdfField) => {
      const labelLines = doc.splitTextToSize(f.label, colW[0] - 2)
      const valStr = fmtCell(r.answers[f.id])
      const valLines = doc.splitTextToSize(valStr, colW[1] - 2)
      const lineH = 3.6
      const rowH = Math.max(8, labelLines.length * lineH + 2, valLines.length * lineH + 2)

      if (y + rowH > yMax) {
        doc.addPage()
        y = M
        doc.setFontSize(9)
        doc.setTextColor(80, 80, 80)
        doc.text(`${title} (${r.user_email}) — continuación`, M, y)
        y += 7
        drawTableHeader(doc, M, y, colW, headers)
        y += 8
        doc.setFont("helvetica", "normal")
        doc.setDrawColor(20, 20, 20)
      }

      let x = M
      doc.setFillColor(...ORANGE)
      doc.rect(x, y, colW[0], rowH, "FD")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.text(labelLines, x + 1, y + 4.2)
      x += colW[0]

      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(20, 20, 20)
      doc.rect(x, y, colW[1], rowH, "FD")
      doc.setTextColor(0, 0, 0)
      doc.text(valLines, x + 1, y + 4.2)

      y += rowH
    }

    for (const f of fields) {
      drawRow(f)
    }
  })

  const week = reports[0]?.week_start ?? "semana"
  doc.save(`kpi-${week}.pdf`)
}
