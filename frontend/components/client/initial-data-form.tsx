"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
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

export function InitialDataForm() {
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const { setClientPhase, userEmail } = useApp()

  const displayName = useMemo(() => {
    if (!userEmail) return "[nombre]"
    const [namePart] = userEmail.split("@")
    if (!namePart) return "[nombre]"
    return namePart.charAt(0).toUpperCase() + namePart.slice(1)
  }, [userEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      const res = await apiFetch("/users/email", {
        method: "PUT",
        body: JSON.stringify({
          old_email: userEmail,
          new_email: email || userEmail,
          phone,
        }),
      })
      if (!res.ok) {
        setError("No se pudo guardar tus datos. Intenta de nuevo.")
        return
      }
      setClientPhase("platforms")
    } catch {
      setError("No se pudo guardar tus datos. Intenta de nuevo.")
    }
  }

  const inputShell =
    "flex h-12 w-full items-center rounded-xl border border-white/[0.14] bg-transparent px-3.5 transition-[border-color,box-shadow] duration-200 focus-within:border-violet-400/45 focus-within:shadow-[0_0_0_1px_rgba(192,132,252,0.15)]"

  const inputInner =
    "min-w-0 flex-1 border-0 bg-transparent text-[15px] text-white placeholder:text-zinc-500 outline-none ring-0 focus:ring-0"

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

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-10 sm:py-14">
        <div className="animate-login-enter flex w-full max-w-[420px] flex-col items-center">
          <div className="relative mb-1 mx-auto h-[120px] w-[min(100%,280px)] sm:h-[140px]">
            <Image
              src="/EvolucionaLogoLogin.png"
              alt="Evoluciona"
              fill
              sizes="280px"
              className="object-contain object-center brightness-0 invert"
              priority
            />
          </div>

          <p className="mb-7 text-center text-2xl text-white">Bienvenido {displayName} a Evoluciona!</p>

          <div className="w-full bg-transparent p-7 backdrop-blur-md sm:p-8">
            <p className="mb-4 text-lg text-white">Completa los siguientes campos:</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="phone" className="text-sm text-gray-200">
                  Numero de celular
                </label>
                <div className={inputShell}>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+54 11 1234 5678"
                    required
                    className={inputInner}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm text-gray-200">
                  Correo electrónico
                </label>
                <div className={inputShell}>
                  <input
                    id="email"
                    type="email"
                    value={email || userEmail}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Sera usado para conceder acceso a Skool"
                    required
                    className={inputInner}
                  />
                </div>
              </div>

              {error && <p className="text-center text-[13px] text-red-400/90">{error}</p>}

              <div className="pt-1">
                <button
                  type="submit"
                  className="h-11 w-full rounded-full border border-zinc-600 bg-zinc-900 px-8 text-white shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-colors hover:border-zinc-400 hover:bg-zinc-800"
                >
                  CONTINUAR
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
