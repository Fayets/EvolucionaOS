"use client"

import { useEffect, useState } from "react"
import { Lock, ChevronRight } from "lucide-react"
import { CLIENT_PHASES, type PhaseName } from "@/lib/phases"
import { ClientLayoutLogo, ClientSidebar } from "@/components/client-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import { CLIENT_NOTIFICATIONS_CHANGED } from "@/lib/use-client-notifications-sse"

const PHASE_COPY: Record<PhaseName, { title: string; subtitle: string }> = {
  Acceso: {
    title: "Acceso",
    subtitle: "Primeros pasos para activar tu entorno y preparar el avance.",
  },
  Onboarding: {
    title: "Onboarding",
    subtitle: "Alineacion inicial de objetivos, foco y estructura de trabajo.",
  },
  "Base de Negocios": {
    title: "Base de negocio",
    subtitle: "Fundamentos del modelo y sistema operativo de tu negocio.",
  },
  Marketing: {
    title: "Marketing",
    subtitle: "Estrategia y ejecucion para atraer demanda predecible.",
  },
  "Proceso de Ventas": {
    title: "Proceso de ventas",
    subtitle: "Conversion, seguimiento y cierres con un sistema claro.",
  },
  Optimizar: {
    title: "Optimizar",
    subtitle: "Escala, mejora continua y consolidacion de resultados.",
  },
}

const PHASE_IMAGES: Record<PhaseName, string> = {
  Acceso: "/phases/acceso.jpg",
  Onboarding: "/phases/onboarding.jpg",
  "Base de Negocios": "/phases/base-de-negocio.jpg",
  Marketing: "/phases/marketing.jpg",
  "Proceso de Ventas": "/phases/proceso-de-ventas.jpg",
  Optimizar: "/phases/optimizar.jpg",
}

interface ClientPhasesViewProps {
  currentPhase: string
  onOpenPhase: (phase: PhaseName) => void
  onGoToInicio: () => void
}

export function ClientPhasesView({ currentPhase, onOpenPhase, onGoToInicio }: ClientPhasesViewProps) {
  const currentIdx = Math.max(CLIENT_PHASES.indexOf(currentPhase as PhaseName), 0)
  const currentPhaseName = CLIENT_PHASES[currentIdx] ?? CLIENT_PHASES[0]
  const [phaseImages, setPhaseImages] = useState<Record<PhaseName, string>>(PHASE_IMAGES)
  const [manualUnlocks, setManualUnlocks] = useState<Set<PhaseName>>(new Set())

  useEffect(() => {
    const loadPhaseImages = async () => {
      try {
        const res = await apiFetch("/settings/phase-images")
        if (!res.ok) return
        const data = (await res.json()) as { images?: Record<string, string> }
        const incoming = data.images ?? {}
        setPhaseImages((prev) => ({
          ...prev,
          Acceso: incoming["Acceso"] || prev.Acceso,
          Onboarding: incoming["Onboarding"] || prev.Onboarding,
          "Base de Negocios": incoming["Base de Negocios"] || prev["Base de Negocios"],
          Marketing: incoming["Marketing"] || prev.Marketing,
          "Proceso de Ventas": incoming["Proceso de Ventas"] || prev["Proceso de Ventas"],
          Optimizar: incoming["Optimizar"] || prev.Optimizar,
        }))
      } catch {
        // ignore
      }
    }
    void loadPhaseImages()
  }, [])

  useEffect(() => {
    const loadUnlocks = async () => {
      try {
        const res = await apiFetch("/users/me/phase-unlocks")
        if (!res.ok) return
        const data = (await res.json()) as { phases?: string[] }
        const valid = new Set(CLIENT_PHASES)
        const next = new Set<PhaseName>()
        for (const p of data.phases ?? []) {
          if (valid.has(p as PhaseName)) next.add(p as PhaseName)
        }
        setManualUnlocks(next)
      } catch {
        // ignore
      }
    }
    void loadUnlocks()
    const onChanged = () => void loadUnlocks()
    window.addEventListener(CLIENT_NOTIFICATIONS_CHANGED, onChanged)
    return () => window.removeEventListener(CLIENT_NOTIFICATIONS_CHANGED, onChanged)
  }, [])

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col items-center">
      <ClientLayoutLogo />
      <div className="flex w-full flex-1">
        <ClientSidebar
          primaryNavLabel="Inicio"
          secondNavLabel="Fases"
          activeNav="secondary"
          onPrimaryNavClick={onGoToInicio}
        />
        <div className="flex-1 px-4 pt-10 pb-10">
          <div className="w-full max-w-6xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">Fases</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Podes ver tu fase actual, revisar las anteriores y visualizar las siguientes.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {CLIENT_PHASES.map((phase, idx) => {
                const unlocked = idx <= currentIdx
                const manuallyUnlocked = manualUnlocks.has(phase)
                const canOpen = unlocked || manuallyUnlocked
                const isCurrent = phase === currentPhase
                const cardCopy = PHASE_COPY[phase]
                const progress = idx < currentIdx ? 100 : isCurrent ? 35 : 0

                return (
                  <Card
                    key={phase}
                    onClick={() => {
                      if (canOpen) onOpenPhase(phase)
                    }}
                    className={`border rounded-xl overflow-hidden ${
                      canOpen
                        ? "border-zinc-700 bg-zinc-900/75"
                        : "border-zinc-800 bg-zinc-900/45 opacity-85"
                    } ${canOpen ? "cursor-pointer" : ""}`}
                    style={{ contentVisibility: "auto", containIntrinsicSize: "320px" }}
                  >
                    <div className="relative h-28 border-b border-zinc-800 bg-zinc-950">
                      <img
                        src={phaseImages[phase]}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        aria-hidden
                        className="absolute inset-0 h-full w-full object-cover opacity-65"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 to-zinc-950/35" />
                      <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-zinc-600 bg-black/40 px-2.5 py-1 text-[11px] uppercase tracking-wide text-zinc-200">
                        Fase {idx + 1}
                      </div>
                      {!canOpen ? (
                        <div className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-zinc-700 bg-black/60">
                          <Lock className="size-4 text-zinc-300" />
                        </div>
                      ) : null}
                    </div>

                    <CardContent className="p-4">
                      <p className="text-lg font-semibold text-white">{cardCopy.title}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{cardCopy.subtitle}</p>

                      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-700/70">
                        <div
                          className="h-full rounded-full bg-emerald-500/90 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">{progress}%</p>

                      <div className="mt-4">
                        <Button
                          type="button"
                          onClick={() => onOpenPhase(phase)}
                          disabled={!canOpen}
                          className="h-10 w-full rounded-full border border-zinc-600 bg-zinc-900 text-white hover:bg-zinc-800 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {canOpen ? (
                            <span className="inline-flex items-center gap-1.5">
                              {isCurrent ? "Entrar a fase actual" : "Ver fase"}
                              <ChevronRight className="size-4" />
                            </span>
                          ) : (
                            "Bloqueada por director"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
