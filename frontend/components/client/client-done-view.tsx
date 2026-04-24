"use client"

import { useCallback, useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { useApp } from "@/lib/app-context"
import { apiFetch } from "@/lib/api"
import { CLIENT_NOTIFICATIONS_CHANGED } from "@/lib/use-client-notifications-sse"
import {
  dispatchNavigateToTask,
  findMandatoryTaskByLabelAcrossPhases,
  findParticularTaskByLabelAcrossPhases,
  parseCorreccionTitleQuotedLabel,
  parseNuevaTareaLabelFromBody,
} from "@/lib/client-task-navigation"
import { ClientLayoutLogo, ClientSidebar } from "@/components/client-sidebar"
import { Card, CardContent } from "@/components/ui/card"

interface UserNotification {
  id: number
  title: string
  body: string | null
  read_at: string | null
  created_at: string | null
}

export function ClientDoneView({ onOpenFases }: { onOpenFases: () => void }) {
  const { userEmail, accessToken } = useApp()
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [notificationNavigateBusyId, setNotificationNavigateBusyId] = useState<number | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!userEmail) return
    try {
      const res = await apiFetch(`/notifications/all?email=${encodeURIComponent(userEmail)}`)
      if (res.ok) {
        const data = await res.json()
        setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      } else {
        setNotifications([])
      }
    } catch {
      setNotifications([])
    }
  }, [userEmail])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    const refresh = () => void fetchNotifications()
    window.addEventListener(CLIENT_NOTIFICATIONS_CHANGED, refresh)
    return () => window.removeEventListener(CLIENT_NOTIFICATIONS_CHANGED, refresh)
  }, [fetchNotifications])

  const accessNotifications = notifications.map((n) => ({
    id: `n-${n.id}`,
    notificationId: n.id,
    label: n.title,
    body: n.body,
    state: n.read_at ? ("Completada" as const) : ("Pendiente" as const),
  }))

  const deleteNotification = async (notificationId: number) => {
    if (!userEmail) return
    const previous = notifications
    setNotifications((current) => current.filter((n) => n.id !== notificationId))
    try {
      const res = await apiFetch(
        `/notifications/${notificationId}?email=${encodeURIComponent(userEmail)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error()
    } catch {
      setNotifications(previous)
    }
  }

  const deleteAllNotifications = async () => {
    if (!userEmail || accessNotifications.length === 0) return
    const previous = notifications
    setNotifications([])
    try {
      const res = await apiFetch(`/notifications/all?email=${encodeURIComponent(userEmail)}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
    } catch {
      setNotifications(previous)
    }
  }

  const handleNotificationNavigate = async (n: UserNotification) => {
    if (notificationNavigateBusyId != null || !userEmail) return
    const title = n.title?.normalize("NFC").trim() ?? ""
    const body = n.body || ""

    if (title === "Nueva tarea asignada") {
      const label = parseNuevaTareaLabelFromBody(body)
      if (!label) return
      setNotificationNavigateBusyId(n.id)
      try {
        const found = await findParticularTaskByLabelAcrossPhases(userEmail, label, {
          bearerToken: accessToken,
        })
        if (found) {
          dispatchNavigateToTask({ phase: found.phase, particularTaskId: found.taskId })
        }
      } finally {
        setNotificationNavigateBusyId(null)
      }
      return
    }

    const correccionLabel = parseCorreccionTitleQuotedLabel(title)
    if (correccionLabel) {
      setNotificationNavigateBusyId(n.id)
      try {
        const found = await findMandatoryTaskByLabelAcrossPhases(correccionLabel, {
          bearerToken: accessToken,
        })
        if (found) {
          dispatchNavigateToTask({ phase: found.phase, mandatoryTaskId: found.taskId })
        }
      } finally {
        setNotificationNavigateBusyId(null)
      }
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col items-center">
      <ClientLayoutLogo />

      <div className="flex w-full flex-1">
        <ClientSidebar
          primaryNavLabel="Inicio"
          secondNavLabel="Fases"
          activeNav="primary"
          onSecondNavClick={onOpenFases}
        />

        <div className="flex-1 flex flex-col items-center justify-start px-4 pt-10 pb-10">
          <div className="w-full max-w-6xl">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                  <p className="text-sm font-semibold text-zinc-100">Notificaciones</p>
                  <button
                    type="button"
                    onClick={() => void deleteAllNotifications()}
                    disabled={accessNotifications.length === 0}
                    title="Eliminar todas"
                    className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="max-h-[min(32rem,56vh)] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
                  {accessNotifications.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-zinc-500">
                      No hay notificaciones.
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-800/80">
                      {accessNotifications.map((notification) => {
                        const raw = notifications.find(
                          (x) => Number(x.id) === Number(notification.notificationId)
                        )
                        const titleNorm = raw?.title?.normalize("NFC").trim() ?? ""
                        const canDeepLink =
                          !!raw &&
                          ((titleNorm === "Nueva tarea asignada" &&
                            parseNuevaTareaLabelFromBody(raw.body) != null) ||
                            parseCorreccionTitleQuotedLabel(raw.title) != null)
                        return (
                          <div
                            key={notification.id}
                            className="flex items-start justify-between gap-3 px-4 py-4"
                          >
                            <button
                              type="button"
                              disabled={!canDeepLink || notificationNavigateBusyId != null}
                              onClick={() => raw && void handleNotificationNavigate(raw)}
                              className={`min-w-0 flex-1 rounded-lg px-0.5 py-0.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
                                canDeepLink
                                  ? "cursor-pointer hover:bg-zinc-800/50 disabled:cursor-wait disabled:opacity-60"
                                  : "cursor-default"
                              }`}
                            >
                              <p className="text-sm text-white">{notification.label}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {notification.body || "Notificacion del administrador"}
                              </p>
                            </button>
                            <div className="flex shrink-0 items-center gap-2">
                              <div
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                  notification.state === "Pendiente"
                                    ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
                                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                }`}
                              >
                                {notification.state}
                              </div>
                              <button
                                type="button"
                                onClick={() => void deleteNotification(notification.notificationId)}
                                title="Eliminar notificacion"
                                className="rounded-md border border-zinc-700 p-1.5 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                <div className="border-b border-zinc-800 px-4 py-3">
                  <p className="text-sm font-semibold text-zinc-100">Programa</p>
                </div>
                <div className="flex flex-col items-center justify-center px-4 py-10">
                  <div className="relative w-full max-w-md">
                    <div className="pointer-events-none absolute -inset-[1px] rounded-2xl border border-violet-400/15 shadow-[0_0_24px_rgba(168,85,247,0.12)]" />
                    <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
                      <CardContent className="pt-8 pb-8 px-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                          <svg
                            className="w-6 h-6 text-emerald-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <h2 className="text-2xl font-semibold">Todo listo</h2>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
