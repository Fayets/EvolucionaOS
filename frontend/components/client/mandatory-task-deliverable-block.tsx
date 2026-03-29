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

  useEffect(() => {
    setNote(stored?.note ?? "")
    setLink(stored?.link ?? "")
  }, [stored?.submitted_at, stored?.note, stored?.link])

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
  )
}
