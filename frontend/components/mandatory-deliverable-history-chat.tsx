"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"

export type MandatoryDeliverableHistoryEntry = {
  note: string
  link: string
  submitted_at: string
  director_note?: string
  director_link?: string
  corrected_at?: string
}

type Props = {
  history: MandatoryDeliverableHistoryEntry[] | undefined | null
  title?: string
  emptyMessage?: string
  className?: string
  panelClassName?: string
}

export function MandatoryDeliverableHistoryChat({
  history: rawHistory,
  title = "Historial de intercambios",
  emptyMessage = "Cuando haya entregas o respuestas del director, vas a ver el hilo acá como en un chat.",
  className,
  panelClassName,
}: Props) {
  const history = useMemo(
    () => (rawHistory ?? []).filter((h) => h.submitted_at || h.note || h.link),
    [rawHistory],
  )

  const chatBubbles = useMemo(() => {
    const out: Array<{
      role: "alumno" | "director"
      note?: string
      link?: string
      at: string
    }> = []
    for (const h of history) {
      if (h.note?.trim() || h.link?.trim() || h.submitted_at) {
        out.push({
          role: "alumno",
          note: h.note,
          link: h.link,
          at: h.submitted_at,
        })
      }
      if (h.director_note?.trim() || h.director_link?.trim()) {
        out.push({
          role: "director",
          note: h.director_note,
          link: h.director_link,
          at: h.corrected_at ?? h.submitted_at,
        })
      }
    }
    return out
  }, [history])

  return (
    <div className={cn("min-w-0 flex flex-col", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-2 shrink-0">
        {title}
      </p>
      <div
        className={cn(
          "flex flex-col gap-2.5 overflow-y-auto rounded-xl border border-zinc-700/60 bg-zinc-950/80 p-3 min-h-[200px]",
          "max-h-[min(420px,calc(85vh-14rem))] lg:max-h-[min(480px,calc(85vh-12rem))]",
          panelClassName,
        )}
      >
        {chatBubbles.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-8 px-2 leading-relaxed">{emptyMessage}</p>
        ) : (
          chatBubbles.map((b, i) => (
            <div
              key={`${b.role}-${b.at}-${i}`}
              className={cn("flex w-full", b.role === "alumno" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[min(100%,18rem)] rounded-2xl px-3 py-2 shadow-sm",
                  b.role === "alumno"
                    ? "rounded-br-md border border-violet-500/30 bg-violet-600/18 text-zinc-100"
                    : "rounded-bl-md border border-amber-500/35 bg-amber-500/10 text-amber-50/95",
                )}
              >
                <p
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-wide mb-1",
                    b.role === "alumno" ? "text-violet-200/90" : "text-amber-200/90",
                  )}
                >
                  {b.role === "alumno" ? "Alumno" : "Director"}
                </p>
                {b.note?.trim() ? (
                  <p className="text-xs whitespace-pre-wrap leading-snug">{b.note}</p>
                ) : null}
                {b.link?.trim() ? (
                  <a
                    href={b.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-block text-xs underline mt-1.5",
                      b.role === "alumno"
                        ? "text-violet-200 hover:text-violet-100"
                        : "text-amber-200 hover:text-amber-100",
                    )}
                  >
                    {b.role === "alumno" ? "Ver entregable" : "Ver enlace de corrección"}
                  </a>
                ) : null}
                <p
                  className={cn(
                    "text-[10px] mt-1.5 tabular-nums",
                    b.role === "alumno" ? "text-zinc-500" : "text-amber-200/65",
                  )}
                >
                  {new Date(b.at).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
