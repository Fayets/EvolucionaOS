"use client"

import { useState, useEffect } from "react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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
  const history = (stored?.history ?? []).filter((h) => h.submitted_at || h.note || h.link)

  useEffect(() => {
    setNote(stored?.note ?? "")
    setLink(stored?.link ?? "")
  }, [stored?.submitted_at, stored?.note, stored?.link, stored?.corrected_at])

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
      onSaved()
    } catch {
      setErr("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-600/40 w-full max-w-full">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2">
        Tu entregable
      </p>
      {stored?.submitted_at ? (
        <p className="text-[11px] text-emerald-400/90 mb-2">
          Enviado el{" "}
          {new Date(stored.submitted_at).toLocaleString("es-AR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      ) : null}
      {(stored?.director_note || stored?.director_link) && stored?.corrected_at ? (
        <div className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
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
      {history.length > 0 ? (
        <div className="mt-4 rounded-lg border border-zinc-700/70 bg-zinc-950/45 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300 mb-2">
            Historial de intercambios
          </p>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={`${h.submitted_at}-${i}`} className="rounded-md border border-zinc-700/60 bg-zinc-900/60 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-violet-300 mb-1">Alumno</p>
                {h.note ? <p className="text-xs text-zinc-200 whitespace-pre-wrap">{h.note}</p> : null}
                {h.link ? (
                  <a
                    href={h.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-violet-300 underline mt-1 hover:text-violet-200"
                  >
                    Ver entregable
                  </a>
                ) : null}
                <p className="text-[10px] text-zinc-500 mt-1">
                  {new Date(h.submitted_at).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                {h.director_note || h.director_link ? (
                  <div className="mt-2 rounded-md border border-amber-500/35 bg-amber-500/10 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-amber-200 mb-1">Director</p>
                    {h.director_note ? (
                      <p className="text-xs text-amber-50/95 whitespace-pre-wrap">{h.director_note}</p>
                    ) : null}
                    {h.director_link ? (
                      <a
                        href={h.director_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs text-amber-200 underline mt-1 hover:text-amber-100"
                      >
                        Ver enlace de corrección
                      </a>
                    ) : null}
                    {h.corrected_at ? (
                      <p className="text-[10px] text-amber-200/70 mt-1">
                        {new Date(h.corrected_at).toLocaleString("es-AR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
