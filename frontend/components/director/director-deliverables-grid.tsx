"use client"

import { useMemo } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  ClipboardList,
  Copy,
  Download,
  FileText,
  Link2,
  MoreVertical,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type DeliverableGridRow = {
  label: string
  note: string
  link: string
  submitted_at: string
  director_note?: string
  director_link?: string
  corrected_at?: string
}

function formatSubmittedShort(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return iso
  }
}

function isProbablyPdf(url: string) {
  const u = url.toLowerCase()
  return (
    u.endsWith(".pdf") ||
    u.includes(".pdf?") ||
    u.includes("/pdf") ||
    (u.includes("drive.google.com") && u.includes("/file/d/"))
  )
}

export function DirectorDeliverablesGoogleGrid({
  entries,
  onRequestCorrection,
  onboardingCard,
}: {
  entries: { slug: string; row: DeliverableGridRow }[]
  onRequestCorrection: (slug: string, label: string) => void
  onboardingCard?: { onDownload: () => void } | null
}) {
  const sorted = useMemo(() => {
    const withLink = entries.filter(e => Boolean(e.row.link?.trim()))
    return withLink.sort(
      (a, b) =>
        new Date(b.row.submitted_at).getTime() - new Date(a.row.submitted_at).getTime()
    )
  }, [entries])

  const openLink = (url: string) => {
    const u = url?.trim()
    if (!u) return
    window.open(u, "_blank", "noopener,noreferrer")
  }

  const copyLink = async (url: string) => {
    const u = url?.trim()
    if (!u) return
    try {
      await navigator.clipboard.writeText(u)
    } catch {
      /* ignore */
    }
  }

  if (sorted.length === 0 && !onboardingCard) {
    return (
      <p className="text-sm text-zinc-500">
        No hay enlaces de entregas todavía. Cuando el alumno adjunte un enlace en una tarea
        obligatoria, aparecerá acá como tarjeta.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-zinc-400">Enlaces enviados por el alumno</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {onboardingCard ? (
          <article
            className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm transition hover:border-violet-400 hover:shadow-md"
          >
            <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
              <FileText className="size-14 text-blue-600" strokeWidth={1.25} aria-hidden />
            </div>
            <div className="flex flex-1 flex-col border-t border-zinc-100 p-3">
              <p className="line-clamp-2 text-sm font-medium leading-snug">
                Formulario de onboarding
              </p>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-2">
                <span className="text-[11px] text-zinc-500">PDF · resumen</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-zinc-600"
                    >
                      <MoreVertical className="size-4" />
                      <span className="sr-only">Acciones</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border-zinc-700 bg-zinc-900 text-white"
                  >
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => onboardingCard.onDownload()}
                    >
                      <Download className="size-4" />
                      Descargar PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </article>
        ) : null}

        {sorted.map(({ slug, row }) => {
          const pdfish = isProbablyPdf(row.link)
          return (
            <article
              key={slug}
              className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm transition hover:border-violet-400 hover:shadow-md"
            >
              <div
                className={cn(
                  "relative flex aspect-[4/3] items-center justify-center border-b border-zinc-100",
                  pdfish
                    ? "bg-gradient-to-br from-red-50 to-orange-50"
                    : "bg-gradient-to-br from-slate-50 to-zinc-100"
                )}
              >
                {pdfish ? (
                  <FileText className="size-14 text-red-600" strokeWidth={1.25} aria-hidden />
                ) : (
                  <Link2 className="size-14 text-violet-600" strokeWidth={1.25} aria-hidden />
                )}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <p className="line-clamp-2 text-sm font-medium leading-snug" title={row.label}>
                  {row.label || slug}
                </p>
                {row.note ? (
                  <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{row.note}</p>
                ) : null}
                {(row.director_note || row.director_link) && row.corrected_at ? (
                  <p className="mt-1 text-[10px] text-amber-800">
                    Corregido {formatSubmittedShort(row.corrected_at)}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center justify-between gap-1 border-t border-zinc-100 pt-2">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-zinc-500">
                    <FileText className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{formatSubmittedShort(row.submitted_at)}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-zinc-600"
                      >
                        <MoreVertical className="size-4" />
                        <span className="sr-only">Acciones</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="border-zinc-700 bg-zinc-900 text-white"
                    >
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => openLink(row.link)}
                      >
                        <Download className="size-4" />
                        Abrir o descargar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => void copyLink(row.link)}
                      >
                        <Copy className="size-4" />
                        Copiar enlace
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zinc-700" />
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => onRequestCorrection(slug, row.label || slug)}
                      >
                        <ClipboardList className="size-4" />
                        Corregir y reenviar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
