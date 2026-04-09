"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/lib/app-context"
import { useClientNotificationsSSE } from "@/lib/use-client-notifications-sse"
import { CLIENT_PHASES, type PhaseName } from "@/lib/phases"
import { InitialDataForm } from "./initial-data-form"
import { PlatformsAccess } from "./platforms-access"
import { PhaseTasks } from "./phase-tasks"
import { OnboardingForm } from "./onboarding-form"
import { ClientDoneView } from "./client-done-view"
import { ClientPhasesView } from "./client-phases-view"

export function ClientView() {
  const { clientPhase, userEmail } = useApp()
  const [programScreen, setProgramScreen] = useState<"fases" | "tasks">("tasks")
  const [selectedPhase, setSelectedPhase] = useState<PhaseName | null>(null)
  const [taskViewMode, setTaskViewMode] = useState<"inicio" | "fase">("inicio")
  useClientNotificationsSSE(userEmail.trim() ? userEmail : null)

  useEffect(() => {
    const isProgram = (CLIENT_PHASES as readonly string[]).includes(clientPhase)
    if (!isProgram) {
      setProgramScreen("tasks")
      setSelectedPhase(null)
      setTaskViewMode("inicio")
      return
    }
    if (taskViewMode === "inicio") {
      setSelectedPhase(clientPhase as PhaseName)
    }
  }, [clientPhase, taskViewMode])

  if (clientPhase === "initial") return <InitialDataForm />
  if (clientPhase === "platforms") return <PlatformsAccess />
  if (clientPhase === "Onboarding") return <OnboardingForm />
  if (clientPhase === "done") return <ClientDoneView />

  const isProgram = (CLIENT_PHASES as readonly string[]).includes(clientPhase)
  if (isProgram) {
    if (programScreen === "fases") {
      return (
        <ClientPhasesView
          currentPhase={clientPhase}
          onOpenPhase={(phase) => {
            setSelectedPhase(phase)
            setTaskViewMode("fase")
            setProgramScreen("tasks")
          }}
          onGoToInicio={() => {
            setSelectedPhase(clientPhase as PhaseName)
            setTaskViewMode("inicio")
            setProgramScreen("tasks")
          }}
        />
      )
    }
    return (
      <PhaseTasks
        phase={selectedPhase ?? clientPhase}
        onBack={() => setProgramScreen("fases")}
        onGoHome={() => {
          setSelectedPhase(clientPhase as PhaseName)
          setTaskViewMode("inicio")
        }}
        forcePhaseView={taskViewMode === "fase"}
      />
    )
  }

  return <InitialDataForm />
}
