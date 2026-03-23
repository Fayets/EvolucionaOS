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

interface ParticularTaskItem {
  id: number
  phase: string
  label: string
  link_url: string
  completed: boolean
}

export function DirectorGenerateTask() {
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
    setLoadingClients(true)
    try {
      const res = await apiFetch("/users/clients")
      if (res.ok) {
        const data = await res.json()
        setClients(Array.isArray(data.clients) ? data.clients : [])
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
    fetchClients()
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
    const label = particularLabel.trim()
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

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-8">Generar tarea</h1>

      <div className="relative w-full mb-8">
        <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/40 via-fuchsia-500/40 to-purple-500/40 blur-2xl opacity-50" />
        <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
          <CardHeader className="pb-2 border-b border-zinc-800 px-6 md:px-8">
            <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
              Seleccionar alumno y fase
            </p>
          </CardHeader>
          <CardContent className="pt-4 px-6 md:px-8 pb-6 space-y-4">
            <div className="flex flex-col gap-2">
              <Label className="text-zinc-200">Alumno</Label>
              {loadingClients ? (
                <p className="text-sm text-zinc-500">Cargando alumnos...</p>
              ) : (
                <select
                  value={selectedEmail}
                  onChange={(e) => setSelectedEmail(e.target.value)}
                  className="h-10 w-full max-w-md rounded-lg border border-zinc-600 bg-zinc-900 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                className="h-10 w-full max-w-md rounded-lg border border-zinc-600 bg-zinc-900 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {CLIENT_PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedEmail && (
        <>
          <div className="relative w-full mb-8">
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/40 via-fuchsia-500/40 to-purple-500/40 blur-2xl opacity-50" />
            <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
              <CardHeader className="pb-2 border-b border-zinc-800 px-6 md:px-8">
                <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
                  Crear tarea particular para {selectedClient?.name || selectedEmail}
                </p>
              </CardHeader>
              <CardContent className="pt-4 px-6 md:px-8 pb-6">
                <form onSubmit={handleCreateParticular} className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-zinc-200">Título de la tarea</Label>
                    <Input
                      value={particularLabel}
                      onChange={(e) => setParticularLabel(e.target.value)}
                      placeholder="Ej: Revisar documento de avance"
                      className="h-10 bg-zinc-900 border-zinc-600 text-white"
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
                      className="h-10 bg-zinc-900 border-zinc-600 text-white"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    La tarea se agregará a la fase &quot;{selectedPhase}&quot; para este alumno.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      className="h-10 px-5 bg-purple-600 hover:bg-purple-700 text-white rounded-full border-0"
                      disabled={particularSubmitting}
                    >
                      {particularSubmitting ? "Creando…" : "Crear tarea particular"}
                    </Button>
                    {particularSuccess && (
                      <span className="text-sm text-emerald-400">Tarea creada.</span>
                    )}
                  </div>
                </form>
                {particularTasks.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-zinc-800">
                    <p className="text-xs text-zinc-400 mb-2">Tareas particulares ya creadas en esta fase:</p>
                    <ul className="space-y-1 text-sm text-zinc-300">
                      {particularTasks.map((t) => (
                        <li key={t.id}>
                          {t.label}
                          {t.link_url && (
                            <a
                              href={t.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-purple-300 underline text-xs"
                            >
                              Ver enlace
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </>
      )}
    </div>
  )
}
