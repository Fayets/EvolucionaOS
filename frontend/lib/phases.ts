export const CLIENT_PHASES = [
  "Acceso",
  "Onboarding",
  "Base de Negocios",
  "Marketing",
  "Proceso de Ventas",
  "Optimizar",
] as const

export type PhaseName = (typeof CLIENT_PHASES)[number]

/** Igual que backend `LEGACY_TO_CANONICAL` para calcular el siguiente paso. */
const LEGACY_TO_CANONICAL: Record<string, PhaseName> = {
  tasks: "Acceso",
  onboarding: "Onboarding",
  "Bases de Negocio": "Base de Negocios",
  "Creación de Funnels": "Marketing",
  "Marketing y Comunicación": "Marketing",
  "Ecosistema de Contenido": "Proceso de Ventas",
  "Procesos de Venta": "Proceso de Ventas",
  "Producto y Funnel Interno": "Optimizar",
}

export function normalizeProgramPhase(phase: string): PhaseName | null {
  if ((CLIENT_PHASES as readonly string[]).includes(phase)) {
    return phase as PhaseName
  }
  return LEGACY_TO_CANONICAL[phase] ?? null
}

export function getNextPhase(current: PhaseName): PhaseName | null {
  const idx = CLIENT_PHASES.indexOf(current)
  if (idx === -1 || idx === CLIENT_PHASES.length - 1) return null
  return CLIENT_PHASES[idx + 1]
}

/** Siguiente fase del programa o `done` si ya está en la última (Optimizar). */
export function getNextPhaseOrDone(current: string): PhaseName | "done" | null {
  const canonical = normalizeProgramPhase(current)
  if (!canonical) return null
  const idx = CLIENT_PHASES.indexOf(canonical)
  if (idx === CLIENT_PHASES.length - 1) return "done"
  return CLIENT_PHASES[idx + 1]
}
