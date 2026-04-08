import { CLIENT_PHASES } from "@/lib/phases"

/**
 * Orden del desplegable (director). En BD existen aliases legacy "tasks" / "onboarding".
 */
export const DIRECTOR_PHASE_BASE: string[] = [
  "initial",
  "platforms",
  "Acceso",
  "Onboarding",
  ...CLIENT_PHASES.slice(2),
]

export const phaseLabel: Record<string, string> = {
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

export function phaseName(phase: string): string {
  return phaseLabel[phase] ?? phase
}

export function phaseSelectValues(currentPhase: string | undefined): string[] {
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
