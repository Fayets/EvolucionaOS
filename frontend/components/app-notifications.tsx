"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { ACTIVATION_TASKS_CHANGED } from "@/lib/use-activation-tasks-sse"
import { CLIENT_NOTIFICATIONS_CHANGED, useClientNotificationsSSE } from "@/lib/use-client-notifications-sse"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useApp } from "@/lib/app-context"
import { apiFetch } from "@/lib/api"

type ClientNotification = {
  id: number
  title: string
  body: string
  read_at: string | null
  created_at: string | null
}

export function AppNotifications() {
  const { userRole, userEmail } = useApp()
  const [newCount, setNewCount] = useState<number>(0)
  const [clientNotifications, setClientNotifications] = useState<ClientNotification[]>([])

  useClientNotificationsSSE(userRole === "client" ? userEmail : null)

  useEffect(() => {
    if (userRole !== "director") return

    const fetchCount = async () => {
      try {
        const res = await apiFetch("/activation-tasks/new-count")
        if (!res.ok) return
        const data = await res.json()
        if (typeof data.count === "number") setNewCount(data.count)
      } catch {
        // ignoramos errores de red
      }
    }

    fetchCount()
    const onChanged = () => fetchCount()
    const onFocus = () => fetchCount()
    window.addEventListener(ACTIVATION_TASKS_CHANGED, onChanged)
    window.addEventListener("focus", onFocus)
    return () => {
      window.removeEventListener(ACTIVATION_TASKS_CHANGED, onChanged)
      window.removeEventListener("focus", onFocus)
    }
  }, [userRole])

  useEffect(() => {
    if (userRole !== "client" || !userEmail) return

    const fetchNotifications = async () => {
      try {
        const res = await apiFetch(
          `/notifications/all?email=${encodeURIComponent(userEmail)}`
        )
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data.notifications) ? data.notifications : []
        setClientNotifications(list)
      } catch {
        // ignoramos
      }
    }

    fetchNotifications()
    const onChanged = () => fetchNotifications()
    const onFocus = () => fetchNotifications()
    window.addEventListener(CLIENT_NOTIFICATIONS_CHANGED, onChanged)
    window.addEventListener("focus", onFocus)
    return () => {
      window.removeEventListener(CLIENT_NOTIFICATIONS_CHANGED, onChanged)
      window.removeEventListener("focus", onFocus)
    }
  }, [userRole, userEmail])

  const hasDirectorAlerts = userRole === "director" && newCount > 0
  const hasClientAlerts = userRole === "client" && clientNotifications.length > 0
  const hasAlerts = hasDirectorAlerts || hasClientAlerts

  return (
    <div className="fixed top-15 right-10 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-200 hover:bg-zinc-800 hover:text-white"
            aria-label="Notificaciones"
          >
            <Bell className="h-5 w-5" />
            {hasAlerts && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-80 border-zinc-800 bg-zinc-950 text-zinc-100"
        >
          <DropdownMenuLabel className="font-semibold text-white">
            Notificaciones
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-zinc-800" />
          {userRole === "director" && (
            hasDirectorAlerts ? (
              <DropdownMenuItem
                className="flex cursor-default flex-col items-start gap-0.5 py-3 focus:bg-zinc-900"
                onSelect={e => e.preventDefault()}
              >
                <span className="text-sm font-medium text-white">
                  {newCount} nueva{newCount > 1 ? "s" : ""} tarea de activación
                </span>
                <span className="text-xs text-zinc-400">
                  Revisá la cola de tareas para ver clientes que hicieron clic en Skool.
                </span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="cursor-default text-xs text-zinc-500 focus:bg-zinc-900"
                onSelect={e => e.preventDefault()}
              >
                No hay notificaciones nuevas por ahora.
              </DropdownMenuItem>
            )
          )}
          {userRole === "client" && (
            hasClientAlerts ? (
              <div className="max-h-64 overflow-y-auto">
                {clientNotifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex cursor-default flex-col items-start gap-0.5 py-3 focus:bg-zinc-900"
                    onSelect={e => e.preventDefault()}
                  >
                    <span className="text-sm font-medium text-white">{n.title}</span>
                    <span className="text-xs text-zinc-400">{n.body}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            ) : (
              <DropdownMenuItem
                className="cursor-default text-xs text-zinc-500 focus:bg-zinc-900"
                onSelect={e => e.preventDefault()}
              >
                No hay notificaciones nuevas por ahora.
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
