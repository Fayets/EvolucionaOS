"use client"

import { useApp } from "@/lib/app-context"
import { useClientNotificationsSSE } from "@/lib/use-client-notifications-sse"
import { CLIENT_PHASES } from "@/lib/phases"
import { InitialDataForm } from "./initial-data-form"
import { PlatformsAccess } from "./platforms-access"
import { PhaseTasks } from "./phase-tasks"
import { OnboardingForm } from "./onboarding-form"
import { ClientDoneView } from "./client-done-view"

export function ClientView() {
  const { clientPhase, userEmail } = useApp()
  useClientNotificationsSSE(userEmail.trim() ? userEmail : null)

  if (clientPhase === "initial") return <InitialDataForm />
  if (clientPhase === "platforms") return <PlatformsAccess />
  if (clientPhase === "Onboarding") return <OnboardingForm />
  if (clientPhase === "done") return <ClientDoneView />

  const isProgram = (CLIENT_PHASES as readonly string[]).includes(clientPhase)
  if (isProgram) return <PhaseTasks phase={clientPhase} />

  return <InitialDataForm />
}
