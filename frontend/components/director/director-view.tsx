"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ClientLayoutLogo } from "@/components/client-sidebar"
import { RegisteredUsersProvider } from "@/lib/registered-users-context"
import { useApp } from "@/lib/app-context"
import { useActivationTasksSSE } from "@/lib/use-activation-tasks-sse"
import { DirectorSidebar, type DirectorViewId } from "./director-sidebar"
import { TasksQueue } from "./tasks-queue"
import { RegisteredUsersList } from "./registered-users-list"
import { DirectorSettings } from "./director-settings"
import { DirectorPhases } from "./director-phases"
import { KpiReportsView } from "./kpi-reports-view"
import { KpiFormulariosView } from "./kpi-formularios-view"
import { cn } from "@/lib/utils"

function initialDirectorView(): DirectorViewId {
  if (typeof window === "undefined") return "tasks"
  const v = new URLSearchParams(window.location.search).get("view")
  if (v === "kpi-formularios") return "kpi-formularios"
  if (v === "kpi") return "kpi"
  return "tasks"
}

export function DirectorView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<DirectorViewId>(initialDirectorView)
  const { userRole } = useApp()
  useActivationTasksSSE(userRole)

  const navigate = useCallback(
    (next: DirectorViewId) => {
      setView(next)
      if (next === "kpi") {
        router.replace("/?view=kpi", { scroll: false })
      } else if (next === "kpi-formularios") {
        router.replace("/?view=kpi-formularios", { scroll: false })
      } else {
        router.replace("/", { scroll: false })
      }
    },
    [router]
  )

  useEffect(() => {
    const v = searchParams.get("view")
    if (v === "kpi-formularios") {
      setView("kpi-formularios")
    } else if (v === "kpi") {
      setView("kpi")
    }
  }, [searchParams])

  const contentPad = view === "kpi" || view === "kpi-formularios"

  return (
    <RegisteredUsersProvider>
      <div className="flex min-h-screen flex-col bg-transparent text-white">
        <ClientLayoutLogo />

        <div className="flex min-h-0 w-full flex-1">
          <DirectorSidebar active={view} onNavigate={navigate} />

          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-10",
              contentPad ? "px-0 pt-2 sm:px-1" : "px-4 pt-6"
            )}
          >
            {view === "tasks" && <TasksQueue />}
            {view === "users" && <RegisteredUsersList />}
            {view === "phases" && <DirectorPhases />}
            {view === "kpi" && (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <KpiReportsView />
              </div>
            )}
            {view === "kpi-formularios" && <KpiFormulariosView />}
            {view === "settings" && <DirectorSettings />}
          </div>
        </div>
      </div>
    </RegisteredUsersProvider>
  )
}
