"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useApp } from "@/lib/app-context"
import { apiFetch } from "@/lib/api"

export function PlatformsAccess() {
  const [skoolClicked, setSkoolClicked] = useState(false)
  const [discordClicked, setDiscordClicked] = useState(false)
  const [discordLink, setDiscordLink] = useState<string | null>(null)
  const { setClientPhase, userEmail } = useApp()

  useEffect(() => {
    apiFetch("/settings/discord-link")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const url = data?.url
        if (url && typeof url === "string" && url.trim()) setDiscordLink(url.trim())
      })
      .catch(() => {})
  }, [])

  const handleSkoolClick = async () => {
    if (!userEmail) return
    try {
      const res = await apiFetch("/activation-tasks/skool-click", {
        method: "POST",
        body: JSON.stringify({ email: userEmail }),
      })
      if (res.ok) setSkoolClicked(true)
    } catch {
      // reintentar al volver a hacer clic
    }
  }

  const handleDiscordClick = async () => {
    if (!userEmail) return
    try {
      const res = await apiFetch("/activation-tasks/discord-click", {
        method: "POST",
        body: JSON.stringify({ email: userEmail }),
      })
      if (res.ok) {
        setDiscordClicked(true)
        if (discordLink) window.open(discordLink, "_blank", "noopener,noreferrer")
      }
    } catch {
      // reintentar al volver a hacer clic
    }
  }

  const canContinue = skoolClicked && discordClicked

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-transparent px-4 py-10 text-white">
      <Image
        src="/evolucionalogologin.png"
        alt="Evoluciona"
        width={140}
        height={140}
        className="mb-6"
      />

      <div className="relative w-full max-w-3xl">
        <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/60 via-fuchsia-500/60 to-purple-500/60 blur-2xl opacity-60" />

        <Card className="relative border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl font-semibold text-center">
              Accesos a las plataformas
            </CardTitle>
            <CardDescription className="text-center text-zinc-300">
              Activá tu acceso a Skool y a Discord para empezar con el programa.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0 pb-6 px-4 md:px-8">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border border-zinc-800 bg-zinc-950/60 text-white rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium">
                    Acceso a Skool
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed text-zinc-300">
                    Plataforma donde vas a encontrar todo el contenido del programa.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    onClick={handleSkoolClick}
                    className="w-full h-11 bg-zinc-900 border border-zinc-600 text-white rounded-full hover:bg-zinc-800 hover:border-zinc-400 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                    variant="ghost"
                  >
                    {skoolClicked ? "Solicitud enviada" : "Ingresar a Skool"}
                  </Button>
                  <p className="text-xs text-zinc-400 mt-3 text-center">
                    Cuando hagas clic, nuestro equipo será notificado para darte acceso.
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-zinc-800 bg-zinc-950/60 text-white rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium">
                    Acceso a Discord
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed text-zinc-300">
                    Canal de comunicación y seguimiento durante todo el programa.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    onClick={handleDiscordClick}
                    className="w-full h-11 bg-zinc-900 border border-zinc-600 text-white rounded-full hover:bg-zinc-800 hover:border-zinc-400 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                    variant="ghost"
                  >
                    {discordClicked ? "Solicitud enviada" : "Ingresar a Discord"}
                  </Button>
                  <p className="text-xs text-zinc-400 mt-3 text-center">
                    Usaremos este canal para coordinar, resolver dudas y hacer seguimiento.
                  </p>
                </CardContent>
              </Card>
            </div>

            {canContinue && (
              <div className="flex justify-end mt-8">
                <Button
                  onClick={async () => {
                    if (!userEmail) return
                    try {
                      const res = await apiFetch("/users/client-phase", {
                        method: "PUT",
                        body: JSON.stringify({ email: userEmail, phase: "Acceso" }),
                      })
                      if (res.ok) setClientPhase("Acceso")
                    } catch {
                      setClientPhase("Acceso")
                    }
                  }}
                  className="px-8 h-11 bg-zinc-900 border border-zinc-600 text-white rounded-full hover:bg-zinc-800 hover:border-zinc-400 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                >
                  CONTINUAR A TAREAS
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
