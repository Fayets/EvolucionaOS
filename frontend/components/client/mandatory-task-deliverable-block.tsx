"use client"

import { useState, useEffect, useRef } from "react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MandatoryDeliverableHistoryChat } from "@/components/mandatory-deliverable-history-chat"

export type MandatoryDeliverableEntry = {
  label: string
  note: string
  link: string
  submitted_at: string
  director_note?: string
  director_link?: string
  corrected_at?: string
  history?: Array<{
    note: string
    link: string
    submitted_at: string
    director_note?: string
    director_link?: string
    corrected_at?: string
  }>
}

/** Parsea un objeto entregable devuelto por la API (obligatoria o particular). */
export function parseMandatoryDeliverableEntry(
  raw: unknown
): MandatoryDeliverableEntry | undefined {
  if (!raw || typeof raw !== "object" || !("submitted_at" in raw)) return undefined
  const e = raw as MandatoryDeliverableEntry & Record<string, unknown>
  if (typeof e.submitted_at !== "string") return undefined
  const row: MandatoryDeliverableEntry = {
    label: String(e.label ?? ""),
    note: String(e.note ?? ""),
    link: String(e.link ?? ""),
    submitted_at: e.submitted_at,
  }
  if (Array.isArray(e.history)) {
    row.history = e.history
      .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
      .map((h) => ({
        note: String(h.note ?? ""),
        link: String(h.link ?? ""),
        submitted_at: String(h.submitted_at ?? ""),
        director_note: typeof h.director_note === "string" ? h.director_note : undefined,
        director_link: typeof h.director_link === "string" ? h.director_link : undefined,
        corrected_at: typeof h.corrected_at === "string" ? h.corrected_at : undefined,
      }))
  }
  if (typeof e.director_note === "string" && e.director_note) row.director_note = e.director_note
  if (typeof e.director_link === "string" && e.director_link) row.director_link = e.director_link
  if (typeof e.corrected_at === "string" && e.corrected_at) row.corrected_at = e.corrected_at
  return row
}

type Props = {
  userEmail: string
  taskSlug: string
  taskLabel: string
  stored: MandatoryDeliverableEntry | undefined
  onSaved: () => void
}

export function MandatoryTaskDeliverableBlock({
  userEmail,
  taskSlug,
  taskLabel,
  stored,
  onSaved,
}: Props) {
  const [note, setNote] = useState(stored?.note ?? "")
  const [link, setLink] = useState(stored?.link ?? "")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const noteSeededFromStored = useRef(!!stored)

  useEffect(() => {
    noteSeededFromStored.current = false
  }, [taskSlug])

  useEffect(() => {
    if (!stored) return
    if (noteSeededFromStored.current) return
    setNote(stored.note ?? "")
    noteSeededFromStored.current = true
  }, [stored, taskSlug])

  useEffect(() => {
    setLink(stored?.link ?? "")
  }, [stored?.link, stored?.corrected_at])

  const submit = async () => {
    setErr(null)
    setSaving(true)
    try {
      const res = await apiFetch("/users/mandatory-deliverables", {
        method: "PUT",
        body: JSON.stringify({
          email: userEmail,
          task_slug: taskSlug,
          task_label: taskLabel,
          note: note.trim() || undefined,
          link: link.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string | { msg: string }[]
      }
      if (!res.ok) {
        const d = data.detail
        const msg =
          typeof d === "string"
            ? d
            : Array.isArray(d)
              ? d.map((x) => x.msg).join(", ")
              : "No se pudo guardar"
        setErr(msg)
        return
      }
      setNote("")
      onSaved()
    } catch {
      setErr("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-600/40 w-full max-w-full grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,360px)] gap-6 lg:gap-8 lg:items-stretch">
      <div className="min-w-0 flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-0">
          Tu entregable
        </p>
        {stored?.submitted_at ? (
          <p className="text-[11px] text-emerald-400/90">
            Enviado el{" "}
            {new Date(stored.submitted_at).toLocaleString("es-AR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        ) : null}
        {(stored?.director_note || stored?.director_link) && stored?.corrected_at ? (
          <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/95 mb-1.5">
              Corrección del director
            </p>
            {stored.director_note ? (
              <p className="text-[13px] text-amber-50/95 whitespace-pre-wrap">
                {stored.director_note}
              </p>
            ) : null}
            {stored.director_link ? (
              <a
                href={stored.director_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-amber-200 underline mt-1.5 hover:text-amber-100"
              >
                Ver enlace de la corrección
              </a>
            ) : null}
            <p className="text-[10px] text-amber-200/60 mt-1.5">
              {new Date(stored.corrected_at).toLocaleString("es-AR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <div className="grid gap-1">
            <Label htmlFor={`del-note-${taskSlug}`} className="text-xs text-zinc-400">
              Comentario (opcional si adjuntás enlace)
            </Label>
            <Textarea
              id={`del-note-${taskSlug}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ej: Link al drive, resumen de lo entregado…"
              className="resize-y bg-zinc-950/80 border-zinc-600 text-white text-sm"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`del-link-${taskSlug}`} className="text-xs text-zinc-400">
              Enlace (Drive, Loom, etc.)
            </Label>
            <Input
              id={`del-link-${taskSlug}`}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              type="text"
              inputMode="url"
              placeholder="https://..."
              className="h-9 bg-zinc-950/80 border-zinc-600 text-white text-sm"
            />
          </div>
          {err ? <p className="text-xs text-red-400">{err}</p> : null}
          <Button
            type="button"
            size="sm"
            disabled={saving || (!note.trim() && !link.trim())}
            onClick={() => void submit()}
            className="w-full sm:w-auto h-9 bg-purple-600 hover:bg-purple-700 text-white rounded-full border-0 text-xs"
          >
            {saving ? "Enviando…" : stored ? "Actualizar entregable" : "Enviar entregable"}
          </Button>
        </div>
      </div>

      <MandatoryDeliverableHistoryChat
        history={stored?.history}
        className="border-t border-zinc-600/40 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
      />
    </div>
  )
}
