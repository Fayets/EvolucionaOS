export const CLIENT_PHASES = [
  "Acceso",
  "Onboarding",
  "Bases de Negocio",
  "Creación de Funnels",
  "Marketing y Comunicación",
  "Ecosistema de Contenido",
  "Procesos de Venta",
  "Producto y Funnel Interno",
] as const

export type PhaseName = (typeof CLIENT_PHASES)[number]

export function getNextPhase(current: PhaseName): PhaseName | null {
  const idx = CLIENT_PHASES.indexOf(current)
  if (idx === -1 || idx === CLIENT_PHASES.length - 1) return null
  return CLIENT_PHASES[idx + 1]
}
