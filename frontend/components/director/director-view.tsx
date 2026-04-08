"use client"

import { useState } from "react"
import { ClientLayoutLogo } from "@/components/client-sidebar"
import { RegisteredUsersProvider } from "@/lib/registered-users-context"
import { useApp } from "@/lib/app-context"
import { useActivationTasksSSE } from "@/lib/use-activation-tasks-sse"
import { DirectorSidebar, type DirectorViewId } from "./director-sidebar"
import { TasksQueue } from "./tasks-queue"
import { RegisteredUsersList } from "./registered-users-list"
import { DirectorSettings } from "./director-settings"
import { DirectorPhases } from "./director-phases"

export function DirectorView() {
  const [view, setView] = useState<DirectorViewId>("tasks")
  const { userRole } = useApp()
  useActivationTasksSSE(userRole)

  return (
    <RegisteredUsersProvider>
        <div className="min-h-screen text-white flex flex-col bg-transparent">
        <ClientLayoutLogo />

        <div className="flex w-full flex-1 min-h-0">
          <DirectorSidebar active={view} onNavigate={setView} />

          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-4 pt-6 pb-10">
            {view === "tasks" && <TasksQueue />}
            {view === "users" && <RegisteredUsersList />}
            {view === "phases" && <DirectorPhases />}
            {view === "settings" && <DirectorSettings />}
          </div>
        </div>
      </div>
    </RegisteredUsersProvider>
  )
}
