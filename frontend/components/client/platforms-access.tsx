"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useApp } from "@/lib/app-context"
import { apiFetch } from "@/lib/api"

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type SpaceStar = { cx: number; cy: number; r: number; o: number; fill: string }

function buildSpaceStarfield(): SpaceStar[] {
  const rand = mulberry32(0x9e3779b9)
  const stars: SpaceStar[] = []

  for (let i = 0; i < 1520; i++) {
    const g = rand()
    stars.push({
      cx: rand() * 1000,
      cy: rand() * 1000,
      r: 0.1 + rand() * 0.32,
      o: 0.1 + rand() * 0.42,
      fill: g > 0.12 ? (g > 0.55 ? "#ffffff" : "#e4e4e8") : "#c4c4cc",
    })
  }
  for (let i = 0; i < 220; i++) {
    stars.push({
      cx: rand() * 1000,
      cy: rand() * 1000,
      r: 0.32 + rand() * 0.42,
      o: 0.26 + rand() * 0.4,
      fill: rand() > 0.25 ? "#ffffff" : "#ddd6e8",
    })
  }
  for (let i = 0; i < 42; i++) {
    stars.push({
      cx: rand() * 1000,
      cy: rand() * 1000,
      r: 0.55 + rand() * 0.55,
      o: 0.42 + rand() * 0.48,
      fill: "#ffffff",
    })
  }
  return stars
}

const SPACE_STARS = buildSpaceStarfield()

function LoginSpaceBackdrop() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {SPACE_STARS.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} opacity={s.o} />
      ))}
    </svg>
  )
}

function LoginNebula() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background: `
          radial-gradient(ellipse 75% 90% at 96% 38%, rgba(130, 55, 155, 0.28) 0%, transparent 52%),
          radial-gradient(ellipse 55% 75% at 88% 72%, rgba(90, 35, 110, 0.16) 0%, transparent 48%),
          radial-gradient(ellipse 40% 55% at 100% 55%, rgba(180, 80, 140, 0.12) 0%, transparent 42%)
        `,
        mixBlendMode: "screen",
        opacity: 0.72,
      }}
    />
  )
}

export function PlatformsAccess() {
  const [skoolClicked, setSkoolClicked] = useState(false)
  const [discordClicked, setDiscordClicked] = useState(false)
  const [skoolSubmitting, setSkoolSubmitting] = useState(false)
  const [discordSubmitting, setDiscordSubmitting] = useState(false)
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
    if (skoolClicked || skoolSubmitting) return
    if (!userEmail) return
    setSkoolSubmitting(true)
    try {
      const res = await apiFetch("/activation-tasks/skool-click", {
        method: "POST",
        body: JSON.stringify({ email: userEmail }),
      })
      if (res.ok) setSkoolClicked(true)
    } catch {
      // reintentar al volver a hacer clic
    } finally {
      setSkoolSubmitting(false)
    }
  }

  const handleDiscordClick = async () => {
    if (discordClicked || discordSubmitting) return
    if (!userEmail) return
    setDiscordSubmitting(true)
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
    } finally {
      setDiscordSubmitting(false)
    }
  }

  const canContinue = skoolClicked && discordClicked

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <LoginSpaceBackdrop />
      <LoginNebula />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-white">
        <div className="relative w-full max-w-3xl">
          <div className="pointer-events-none absolute -inset-[1px] rounded-2xl border border-violet-400/15 shadow-[0_0_28px_rgba(168,85,247,0.14)]" />

          <Card className="relative rounded-2xl border border-zinc-800 bg-black/80 text-white shadow-[0_0_40px_rgba(0,0,0,0.9)]">
          <CardHeader className="pb-6">
            <div className="relative mx-auto mb-2 h-[84px] w-[140px]">
              <Image
                src="/EvolucionaLogoLogin.png"
                alt="Evoluciona"
                fill
                sizes="140px"
                className="object-contain object-center brightness-0 invert"
                priority
              />
            </div>
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
                    disabled={skoolClicked || skoolSubmitting}
                  >
                    {skoolSubmitting ? "Enviando..." : skoolClicked ? "Solicitud enviada" : "Ingresar a Skool"}
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
                    disabled={discordClicked || discordSubmitting}
                  >
                    {discordSubmitting ? "Enviando..." : discordClicked ? "Solicitud enviada" : "Ingresar a Discord"}
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
    </div>
  )
}
