import { cn } from "@/lib/utils"

/**
 * Misma pintura para «Usuario», «Tarea a usuario», «Avanzar fase», etc.
 * (`<button>` nativo para evitar estilos del `Button` de shadcn).
 */
export const DIRECTOR_TOOLBAR_BUTTON_CLASS = cn(
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-zinc-600 bg-zinc-950/80 px-3 text-sm font-medium text-zinc-200 shadow-xs",
  "transition-colors hover:bg-zinc-900 hover:text-white",
  "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
  "disabled:pointer-events-none disabled:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
)
