"use client"

import { useState, useEffect, useRef } from "react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MandatoryDeliverableHistoryChat } from "@/components/mandatory-deliverable-history-chat"
import type { MandatoryDeliverableEntry } from "@/components/client/mandatory-task-deliverable-block"

type Props = {
  userEmail: string
  taskId: number
  stored: MandatoryDeliverableEntry | undefined
  onSaved: () => void
}

export function ParticularTaskDeliverableBlock({
  userEmail,
  taskId,
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
  }, [taskId])

  useEffect(() => {
    if (!stored) return
    if (noteSeededFromStored.current) return
    setNote(stored.note ?? "")
    noteSeededFromStored.current = true
  }, [stored, taskId])

  useEffect(() => {
    setLink(stored?.link ?? "")
  }, [stored?.link, stored?.corrected_at])

  const submit = async () => {
    setErr(null)
    setSaving(true)
    try {
      const res = await apiFetch(`/particular-tasks/${taskId}/deliverable`, {
        method: "PUT",
        body: JSON.stringify({
          email: userEmail,
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

  const idBase = `part-del-${taskId}`

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
            <Label htmlFor={`${idBase}-note`} className="text-xs text-zinc-400">
              Comentario (opcional si adjuntás enlace)
            </Label>
            <Textarea
              id={`${idBase}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ej: Link al drive, resumen de lo entregado…"
              className="resize-y bg-zinc-950/80 border-zinc-600 text-white text-sm"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`${idBase}-link`} className="text-xs text-zinc-400">
              Enlace (Drive, Loom, etc.)
            </Label>
            <Input
              id={`${idBase}-link`}
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
            {saving ? "Enviando…" : stored?.submitted_at ? "Actualizar entregable" : "Enviar entregable"}
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
