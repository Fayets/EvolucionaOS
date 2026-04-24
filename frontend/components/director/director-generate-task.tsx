"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/api"
import { CLIENT_PHASES } from "@/lib/phases"

interface ClientItem {
  email: string
  name: string
}

/** Lista de alumnos para el desplegable: se reutiliza entre aperturas del diálogo (evita lag). */
let clientsListCache: ClientItem[] | null = null

/** Llamar tras registrar un usuario nuevo para que el siguiente «Tarea a usuario» traiga la lista actualizada. */
export function invalidateDirectorGenerateClientsCache() {
  clientsListCache = null
}

interface ParticularTaskItem {
  id: number
  phase: string
  label: string
  link_url: string
  completed: boolean
}

type DirectorGenerateTaskProps = {
  /** Contenido apilado sin título de página ni ancho máximo del layout */
  embedded?: boolean
}

export function DirectorGenerateTask({ embedded }: DirectorGenerateTaskProps = {}) {
  const [clients, setClients] = useState<ClientItem[]>([])
  const [selectedEmail, setSelectedEmail] = useState<string>("")
  const [selectedPhase, setSelectedPhase] = useState<string>(CLIENT_PHASES[0])
  const [particularTasks, setParticularTasks] = useState<ParticularTaskItem[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  // Formulario tarea particular
  const [particularLabel, setParticularLabel] = useState("")
  const [particularLink, setParticularLink] = useState("")
  const [particularSubmitting, setParticularSubmitting] = useState(false)
  const [particularSuccess, setParticularSuccess] = useState(false)

  const fetchClients = useCallback(async () => {
    if (clientsListCache !== null) {
      setClients(clientsListCache)
      setLoadingClients(false)
      try {
        const res = await apiFetch("/users/clients")
        if (res.ok) {
          const data = await res.json()
          const list = Array.isArray(data.clients) ? data.clients : []
          clientsListCache = list
          setClients(list)
        }
      } catch {
        /* mantener cache */
      }
      return
    }

    setLoadingClients(true)
    try {
      const res = await apiFetch("/users/clients")
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data.clients) ? data.clients : []
        clientsListCache = list
        setClients(list)
      } else {
        setClients([])
      }
    } catch {
      setClients([])
    } finally {
      setLoadingClients(false)
    }
  }, [])

  useEffect(() => {
    // Deja que el diálogo pinte overlay + marco antes del fetch (menos sensación de “traba”).
    const id = requestAnimationFrame(() => {
      void fetchClients()
    })
    return () => cancelAnimationFrame(id)
  }, [fetchClients])

  const fetchParticularTasks = useCallback(async () => {
    if (!selectedEmail || !selectedPhase) {
      setParticularTasks([])
      return
    }
    try {
      const res = await apiFetch(
        `/particular-tasks/all?email=${encodeURIComponent(selectedEmail)}&phase=${encodeURIComponent(selectedPhase)}`
      )
      if (res.ok) {
        const data = await res.json()
        setParticularTasks(Array.isArray(data.tasks) ? data.tasks : [])
      } else {
        setParticularTasks([])
      }
    } catch {
      setParticularTasks([])
    }
  }, [selectedEmail, selectedPhase])

  useEffect(() => {
    fetchParticularTasks()
  }, [fetchParticularTasks])

  const handleCreateParticular = async (e: React.FormEvent) => {
    e.preventDefault()
    const label = particularLabel.trim().toUpperCase()
    if (!label || !selectedEmail) return
    setParticularSubmitting(true)
    setParticularSuccess(false)
    try {
      const res = await apiFetch("/particular-tasks/register", {
        method: "POST",
        body: JSON.stringify({
          email: selectedEmail,
          phase: selectedPhase,
          label,
          link_url: particularLink.trim() || undefined,
        }),
      })
      if (res.ok) {
        setParticularLabel("")
        setParticularLink("")
        setParticularSuccess(true)
        setTimeout(() => setParticularSuccess(false), 3000)
        fetchParticularTasks()
      }
    } catch {
      // ignorar
    } finally {
      setParticularSubmitting(false)
    }
  }

  const selectedClient = clients.find((c) => c.email === selectedEmail)

  const selectionFields = (
    <>
      <div className="flex flex-col gap-2">
        <Label className="text-zinc-200">Alumno</Label>
        {loadingClients ? (
          <p className="text-sm text-zinc-500">Cargando alumnos...</p>
        ) : (
          <select
            value={selectedEmail}
            onChange={(e) => setSelectedEmail(e.target.value)}
            className="h-10 w-full max-w-md rounded-lg border border-zinc-600 bg-zinc-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">-- Elegir alumno --</option>
            {clients.map((c) => (
              <option key={c.email} value={c.email}>
                {c.name || c.email} ({c.email})
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-zinc-200">Fase</Label>
        <select
          value={selectedPhase}
          onChange={(e) => setSelectedPhase(e.target.value)}
          className="h-10 w-full max-w-md rounded-lg border border-zinc-600 bg-zinc-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {CLIENT_PHASES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
    </>
  )

  const createFormBlock = (
    <>
      <form onSubmit={handleCreateParticular} className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label className="text-zinc-200">Título de la tarea</Label>
          <Input
            value={particularLabel}
            onChange={(e) => setParticularLabel(e.target.value.toUpperCase())}
            placeholder="EJ: REVISAR DOCUMENTO DE AVANCE"
            autoCapitalize="characters"
            className="h-10 border-zinc-600 bg-zinc-900 uppercase text-white"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-zinc-200">Enlace (opcional)</Label>
          <Input
            value={particularLink}
            onChange={(e) => setParticularLink(e.target.value)}
            placeholder="https://..."
            type="url"
            className="h-10 border-zinc-600 bg-zinc-900 text-white"
          />
        </div>
        <p className="text-xs text-zinc-500">
          La tarea se agregará a la fase &quot;{selectedPhase}&quot; para este alumno.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            className="h-10 rounded-full border-0 bg-purple-600 px-5 text-white hover:bg-purple-700"
            disabled={particularSubmitting}
          >
            {particularSubmitting ? "Creando…" : "Crear tarea particular"}
          </Button>
          {particularSuccess ? (
            <span className="text-sm text-emerald-400">Tarea creada.</span>
          ) : null}
        </div>
      </form>
      {particularTasks.length > 0 ? (
        <div className="mt-6 border-t border-zinc-800 pt-4">
          <p className="mb-2 text-xs text-zinc-400">Tareas particulares ya creadas en esta fase:</p>
          <ul className="space-y-1 text-sm text-zinc-300">
            {particularTasks.map((t) => (
              <li key={t.id} className="uppercase">
                {t.label}
                {t.link_url ? (
                  <a
                    href={t.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs text-purple-300 underline"
                  >
                    Ver enlace
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )

  const body = embedded ? (
    <>
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Seleccionar alumno y fase
        </p>
        <div className="space-y-4">{selectionFields}</div>
      </div>
      {selectedEmail ? (
        <div className="mt-6 space-y-4 border-t border-zinc-800 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Crear tarea particular para {selectedClient?.name || selectedEmail}
          </p>
          <div className="space-y-4">{createFormBlock}</div>
        </div>
      ) : null}
    </>
  ) : (
    <>
      <div className="relative mb-8 w-full">
        <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/40 via-fuchsia-500/40 to-purple-500/40 opacity-50 blur-2xl" />
        <Card className="relative w-full rounded-2xl border border-zinc-800 bg-black/80 text-white shadow-[0_0_40px_rgba(0,0,0,0.9)]">
          <CardHeader className="border-b border-zinc-800 px-6 pb-2 md:px-8">
            <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
              Seleccionar alumno y fase
            </p>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6 pt-4 md:px-8">{selectionFields}</CardContent>
        </Card>
      </div>
      {selectedEmail ? (
        <div className="relative mb-8 w-full">
          <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/40 via-fuchsia-500/40 to-purple-500/40 opacity-50 blur-2xl" />
          <Card className="relative w-full rounded-2xl border border-zinc-800 bg-black/80 text-white shadow-[0_0_40px_rgba(0,0,0,0.9)]">
            <CardHeader className="border-b border-zinc-800 px-6 pb-2 md:px-8">
              <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
                Crear tarea particular para {selectedClient?.name || selectedEmail}
              </p>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-4 md:px-8">{createFormBlock}</CardContent>
          </Card>
        </div>
      ) : null}
    </>
  )

  if (embedded) {
    return <div className="w-full space-y-4 text-white">{body}</div>
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-8">Generar tarea</h1>
      {body}
    </div>
  )
}
