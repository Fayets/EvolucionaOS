import { CLIENT_PHASES } from "@/lib/phases"
import { apiFetch } from "@/lib/api"

/** Evento global: ClientView cambia fase y PhaseTasks abre el modal indicado. */
export const CLIENT_NAVIGATE_TO_TASK = "evoluciona-client-navigate-to-task"

export type ClientNavigateToTaskDetail = {
  phase: string
  particularTaskId?: number
  mandatoryTaskId?: number
}

export function dispatchNavigateToTask(detail: ClientNavigateToTaskDetail) {
  window.dispatchEvent(new CustomEvent(CLIENT_NAVIGATE_TO_TASK, { detail }))
}

/** Compara etiquetas aunque difieran en acentos (ELECCION vs ELECCIÓN). */
export function foldLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** Body: "Tenés una nueva tarea: LABEL" (backend particular_task_services) */
export function parseNuevaTareaLabelFromBody(body: string | null | undefined): string | null {
  if (!body?.trim()) return null
  const b = body.normalize("NFC").trim()
  // "Tenés" = T-e-n-é-s (antes estaba mal como Ten[eé]s = T-e-n-(e|é)-s)
  const m =
    b.match(/Ten(?:é|e)s\s+una\s+nueva\s+tarea\s*:\s*(.+)$/is) ||
    b.match(/nueva\s+tarea\s*:\s*(.+)$/i)
  return m?.[1]?.trim() || null
}

/** Title: "Corrección del entregable: «LABEL»" */
export function parseCorreccionTitleQuotedLabel(title: string | null | undefined): string | null {
  if (!title?.trim()) return null
  const m = title.match(/Correcci[oó]n del entregable:\s*[«"]([^»"]+)[»"]/i)
  return m?.[1]?.trim() || null
}

export async function findParticularTaskByLabelAcrossPhases(
  email: string,
  label: string,
  opts?: { bearerToken?: string | null }
): Promise<{ phase: string; taskId: number } | null> {
  const want = foldLabel(label)
  if (!want) return null
  const fetchOpts = opts?.bearerToken !== undefined ? { bearerToken: opts.bearerToken } : {}
  for (const ph of CLIENT_PHASES) {
    try {
      const res = await apiFetch(
        `/particular-tasks/all?email=${encodeURIComponent(email)}&phase=${encodeURIComponent(ph)}`,
        fetchOpts
      )
      if (!res.ok) continue
      const data = (await res.json()) as { tasks?: { id: number; label: string }[] }
      const tasks = Array.isArray(data.tasks) ? data.tasks : []
      const t = tasks.find((x) => foldLabel(x.label || "") === want)
      if (t) return { phase: ph, taskId: t.id }
    } catch {
      /* ignore */
    }
  }
  return null
}

export async function findMandatoryTaskByLabelAcrossPhases(
  label: string,
  opts?: { bearerToken?: string | null }
): Promise<{ phase: string; taskId: number } | null> {
  const want = foldLabel(label)
  if (!want) return null
  const fetchOpts = opts?.bearerToken !== undefined ? { bearerToken: opts.bearerToken } : {}
  for (const ph of CLIENT_PHASES) {
    try {
      const res = await apiFetch(`/mandatory-tasks?phase=${encodeURIComponent(ph)}`, fetchOpts)
      if (!res.ok) continue
      const list = (await res.json()) as { id: number; label: string }[]
      if (!Array.isArray(list)) continue
      const t = list.find((x) => foldLabel(x.label || "") === want)
      if (t) return { phase: ph, taskId: t.id }
    } catch {
      /* ignore */
    }
  }
  return null
}
