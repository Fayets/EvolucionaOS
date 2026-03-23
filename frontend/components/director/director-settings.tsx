"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"
import { CLIENT_PHASES } from "@/lib/phases"

interface MandatoryTaskItem {
  id: number
  slug: string
  label: string
  link_url: string
  order: number | null
  phase: string
}

export function DirectorSettings() {
  const [discordLink, setDiscordLink] = useState("")
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const [phaseTasks, setPhaseTasks] = useState<MandatoryTaskItem[]>([])
  const [selectedPhase, setSelectedPhase] = useState(CLIENT_PHASES[0])
  const [newTaskLabel, setNewTaskLabel] = useState("")
  const [newTaskLink, setNewTaskLink] = useState("")
  const [tasksLoading, setTasksLoading] = useState(false)
  const [taskSavedId, setTaskSavedId] = useState<number | null>(null)

  const fetchTasks = useCallback(async (phase: string) => {
    setTasksLoading(true)
    try {
      const res = await apiFetch(`/mandatory-tasks?phase=${encodeURIComponent(phase)}`)
      if (res.ok) {
        const data = await res.json()
        setPhaseTasks(data)
      } else {
        setPhaseTasks([])
      }
    } catch {
      setPhaseTasks([])
    } finally {
      setTasksLoading(false)
    }
  }, [])

  useEffect(() => {
    const fetchLink = async () => {
      try {
        const res = await apiFetch("/settings/discord-link")
        if (res.ok) {
          const data = await res.json()
          setDiscordLink(data.url ?? "")
        }
      } catch {
        // ignorar
      } finally {
        setLoading(false)
      }
    }
    fetchLink()
  }, [])

  useEffect(() => {
    fetchTasks(selectedPhase)
  }, [selectedPhase, fetchTasks])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    try {
      const res = await apiFetch("/settings/discord-link", {
        method: "PUT",
        body: JSON.stringify({ url: discordLink.trim() || "" }),
      })
      if (res.ok) setSaved(true)
    } catch {
      // ignorar
    }
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const label = newTaskLabel.trim()
    if (!label) return
    try {
      const res = await apiFetch("/mandatory-tasks", {
        method: "POST",
        body: JSON.stringify({
          label,
          link_url: newTaskLink.trim() || undefined,
          phase: selectedPhase,
        }),
      })
      if (res.ok) {
        setNewTaskLabel("")
        setNewTaskLink("")
        fetchTasks(selectedPhase)
      }
    } catch {
      // ignorar
    }
  }

  const handleUpdateTask = async (taskId: number, label: string, link_url: string) => {
    try {
      const res = await apiFetch(`/mandatory-tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ label: label.trim() || undefined, link_url: link_url.trim() || undefined }),
      })
      if (res.ok) {
        setTaskSavedId(taskId)
        setTimeout(() => setTaskSavedId(null), 2000)
        fetchTasks(selectedPhase)
      }
    } catch {
      // ignorar
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("¿Quitar esta tarea de la fase?")) return
    try {
      const res = await apiFetch(`/mandatory-tasks/${taskId}`, { method: "DELETE" })
      if (res.ok) {
        await fetchTasks(selectedPhase)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.detail || "No se pudo eliminar la tarea")
      }
    } catch {
      alert("Error de conexión al eliminar")
    }
  }

  const cardShell = (children: ReactNode, title: string) => (
    <div className="relative w-full">
      <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/40 via-fuchsia-500/40 to-purple-500/40 blur-2xl opacity-50" />
      <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
        <CardHeader className="pb-2 border-b border-zinc-800 px-6 md:px-8">
          <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
            {title}
          </p>
        </CardHeader>
        <CardContent className="pt-4 px-6 md:px-8 pb-6 text-white">
          {children}
        </CardContent>
      </Card>
    </div>
  )

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto flex items-center justify-center py-12">
        <p className="text-zinc-500">Cargando ajustes...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold text-white mb-8">Ajustes</h1>

      {cardShell(
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="discord-link" className="text-zinc-200">
              Link de Discord para clientes
            </Label>
            <Input
              id="discord-link"
              type="url"
              value={discordLink}
              onChange={(e) => setDiscordLink(e.target.value)}
              placeholder="https://discord.gg/..."
              className="h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            <p className="text-xs text-zinc-500">
              Este enlace se mostrará cuando el cliente haga clic en &quot;Ingresar a Discord&quot; en la vista de accesos a plataformas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              className="h-10 px-6 bg-purple-600 hover:bg-purple-700 text-white rounded-full border-0"
            >
              Guardar
            </Button>
            {saved && (
              <span className="text-sm text-emerald-400">Guardado correctamente.</span>
            )}
          </div>
        </form>,
        "Link de Discord"
      )}

      {cardShell(
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-zinc-200">Fase</Label>
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value)}
              className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {CLIENT_PHASES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">
              Tareas predeterminadas que verán los clientes en esta fase. El texto del enlace en la app será &quot;Ver enlace&quot;.
            </p>
          </div>

          {tasksLoading ? (
            <p className="text-zinc-500 text-sm">Cargando tareas...</p>
          ) : (
            <div className="space-y-3">
              {phaseTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onSave={handleUpdateTask}
                  onDelete={handleDeleteTask}
                  saved={taskSavedId === task.id}
                />
              ))}
            </div>
          )}

          <form onSubmit={handleAddTask} className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
            <Label className="text-zinc-200">Agregar tarea a la fase &quot;{selectedPhase}&quot;</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                value={newTaskLabel}
                onChange={(e) => setNewTaskLabel(e.target.value)}
                placeholder="Ej: Ver video onboarding"
                className="flex-1 min-w-[180px] h-10 bg-zinc-900 border-zinc-700 text-white"
              />
              <Input
                value={newTaskLink}
                onChange={(e) => setNewTaskLink(e.target.value)}
                placeholder="https://..."
                type="url"
                className="flex-1 min-w-[180px] h-10 bg-zinc-900 border-zinc-700 text-white"
              />
              <Button type="submit" className="h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full border-0">
                Agregar tarea
              </Button>
            </div>
          </form>
        </div>,
        "Tareas predeterminadas por fase"
      )}
    </div>
  )
}

function TaskRow({
  task,
  onSave,
  onDelete,
  saved,
}: {
  task: MandatoryTaskItem
  onSave: (id: number, label: string, link_url: string) => void
  onDelete: (id: number) => void
  saved: boolean
}) {
  const [label, setLabel] = useState(task.label)
  const [linkUrl, setLinkUrl] = useState(task.link_url || "")

  useEffect(() => {
    setLabel(task.label)
    setLinkUrl(task.link_url || "")
  }, [task.id, task.label, task.link_url])

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Título"
        className="flex-1 min-w-[140px] h-9 bg-zinc-800 border-zinc-600 text-white text-sm"
      />
      <Input
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        placeholder="URL del enlace (Ver enlace)"
        type="url"
        className="flex-1 min-w-[160px] h-9 bg-zinc-800 border-zinc-600 text-white text-sm"
      />
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          className="h-9 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full border-0 text-xs"
          onClick={() => onSave(task.id, label, linkUrl)}
        >
          {saved ? "Guardado" : "Guardar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 px-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 text-xs"
          onClick={() => onDelete(task.id)}
        >
          Quitar
        </Button>
      </div>
    </div>
  )
}
