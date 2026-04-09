"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/lib/app-context"
import {
  CLIENT_NAVIGATE_TO_TASK,
  type ClientNavigateToTaskDetail,
} from "@/lib/client-task-navigation"
import { useClientNotificationsSSE } from "@/lib/use-client-notifications-sse"
import { CLIENT_PHASES, type PhaseName } from "@/lib/phases"

const LAST_PROGRAM_PHASE = CLIENT_PHASES[CLIENT_PHASES.length - 1]
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
  const [navigateToTaskRequest, setNavigateToTaskRequest] =
    useState<ClientNavigateToTaskDetail | null>(null)
  /** Pantalla dentro de fase «done»: tarjeta final, grilla de fases o tareas de una fase. */
  const [doneScreen, setDoneScreen] = useState<"card" | "fases" | "tasks">("card")
  const [donePhase, setDonePhase] = useState<PhaseName | null>(null)
  useClientNotificationsSSE(userEmail.trim() ? userEmail : null)

  useEffect(() => {
    const fn = (e: Event) => {
      const d = (e as CustomEvent<ClientNavigateToTaskDetail>).detail
      if (!d?.phase) return
      if (clientPhase === "done") {
        setDonePhase(d.phase as PhaseName)
        setDoneScreen("tasks")
        setNavigateToTaskRequest(d)
        return
      }
      setSelectedPhase(d.phase as PhaseName)
      setTaskViewMode("fase")
      setProgramScreen("tasks")
      setNavigateToTaskRequest(d)
    }
    window.addEventListener(CLIENT_NAVIGATE_TO_TASK, fn as EventListener)
    return () => window.removeEventListener(CLIENT_NAVIGATE_TO_TASK, fn as EventListener)
  }, [clientPhase])

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

  /** Si el servidor avanza la fase (p. ej. director aprueba), alinear la vista aunque estés en modo “fase”. */
  useEffect(() => {
    if (!(CLIENT_PHASES as readonly string[]).includes(clientPhase)) return
    setSelectedPhase((prev) => {
      if (prev === null) return clientPhase as PhaseName
      const pi = CLIENT_PHASES.indexOf(prev as PhaseName)
      const ci = CLIENT_PHASES.indexOf(clientPhase as PhaseName)
      if (pi === -1) return clientPhase as PhaseName
      if (ci > pi) return clientPhase as PhaseName
      return prev
    })
  }, [clientPhase])

  useEffect(() => {
    if (clientPhase !== "done") {
      setDoneScreen("card")
      setDonePhase(null)
    }
  }, [clientPhase])

  if (clientPhase === "initial") return <InitialDataForm />
  if (clientPhase === "platforms") return <PlatformsAccess />
  if (clientPhase === "Onboarding") return <OnboardingForm />
  if (clientPhase === "done") {
    if (doneScreen === "tasks" && donePhase) {
      return (
        <PhaseTasks
          phase={donePhase}
          onBack={() => {
            setDoneScreen("fases")
            setDonePhase(null)
          }}
          onGoHome={() => {
            setDoneScreen("card")
            setDonePhase(null)
          }}
          forcePhaseView
          navigateToTaskRequest={navigateToTaskRequest}
          onNavigateToTaskConsumed={() => setNavigateToTaskRequest(null)}
        />
      )
    }
    if (doneScreen === "fases") {
      return (
        <ClientPhasesView
          currentPhase={LAST_PROGRAM_PHASE}
          onOpenPhase={(phase) => {
            setDonePhase(phase)
            setDoneScreen("tasks")
          }}
          onGoToInicio={() => setDoneScreen("card")}
        />
      )
    }
    return <ClientDoneView onOpenFases={() => setDoneScreen("fases")} />
  }

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
        navigateToTaskRequest={navigateToTaskRequest}
        onNavigateToTaskConsumed={() => setNavigateToTaskRequest(null)}
      />
    )
  }

  return <InitialDataForm />
}
