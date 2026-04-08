"use client"

import { useState } from "react"
import Image from "next/image"
import { Lock, Mail } from "lucide-react"
import { useApp, type UserRole } from "@/lib/app-context"
import { apiUrl, setToken } from "@/lib/api"

/** PRNG determinístico para estrellas fijas entre SSR y cliente */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type SpaceStar = { cx: number; cy: number; r: number; o: number; fill: string }

/** Campo estrellado: motas más chicas (radios bajos en viewBox 1000×1000) */
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

/** Nebulosa violeta/rosa suave a la derecha, como en el mockup */
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

function Spinner() {
  return (
    <svg
      className="animate-spin-slow size-5"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.5"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { setIsLoggedIn, setUserRole, setUserEmail, setClientPhase, setAccessToken } = useApp()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const params = new URLSearchParams()
    params.set("email", email)
    params.set("password", password)

    let res: Response
    try {
      res = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      })
    } catch {
      setError("No se pudo conectar con el servidor.")
      setLoading(false)
      return
    }

    if (!res.ok) {
      try {
        const data = await res.json()
        setError(typeof data.detail === "string" ? data.detail : "Credenciales incorrectas.")
      } catch {
        setError("Error al iniciar sesión.")
      }
      setLoading(false)
      return
    }

    const data = await res.json()
    const backendRole = (data.role ?? "") as string
    const mappedRole: UserRole = backendRole === "SISTEMAS" ? "director" : "client"

    const token = typeof data.access_token === "string" ? data.access_token : ""
    setToken(token || null)
    setAccessToken(token)
    setUserEmail(data.email ?? email)
    setUserRole(mappedRole)
    if (mappedRole === "client" && data.client_phase) {
      setClientPhase(data.client_phase)
    } else {
      setClientPhase("initial")
    }
    setIsLoggedIn(true)
  }

  const inputShell =
    "flex h-12 w-full items-center gap-3 rounded-xl border border-white/[0.14] bg-transparent px-3.5 transition-[border-color,box-shadow] duration-200 focus-within:border-violet-400/45 focus-within:shadow-[0_0_0_1px_rgba(192,132,252,0.15)]"

  const inputInner =
    "min-w-0 flex-1 border-0 bg-transparent text-[15px] text-white placeholder:text-zinc-500 outline-none ring-0 focus:ring-0"

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <LoginSpaceBackdrop />
      <LoginNebula />

      {/* PNG en public: login-silhouette.png — a la derecha; screen si el fondo del PNG es oscuro */}
      <div
        className="pointer-events-none absolute bottom-0 right-[-6%] z-0 w-[min(88vw,460px)] sm:right-0 sm:w-[min(92vw,520px)]"
        aria-hidden
      >
        <div className="mix-blend-screen opacity-[0.44] sm:opacity-[0.5]">
          <Image
            src="/login-silhouette.png"
            alt=""
            width={800}
            height={800}
            className="h-auto w-full object-contain object-bottom [filter:drop-shadow(0_0_24px_rgba(255,255,255,0.1))]"
            priority
          />
        </div>
      </div>

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

          <div className="w-full bg-transparent p-7 backdrop-blur-md sm:p-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className={inputShell}>
                <Mail className="size-[18px] shrink-0 text-zinc-400" aria-hidden />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@ejemplo.com"
                  required
                  autoComplete="email"
                  aria-label="Email"
                  className={inputInner}
                />
              </div>

              <div className={inputShell}>
                <Lock className="size-[18px] shrink-0 text-zinc-400" aria-hidden />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  aria-label="Contraseña"
                  className={inputInner}
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-[52px] w-full cursor-pointer items-center justify-center rounded-xl text-[15px] font-semibold text-zinc-950 shadow-[0_0_24px_-4px_rgba(168,85,247,0.55)] outline-none transition-[filter,transform,opacity] duration-200 hover:brightness-105 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
                  style={{
                    background: "linear-gradient(90deg, #a855f7, #c084fc)",
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2 text-zinc-900">
                      <Spinner />
                      <span>Ingresando…</span>
                    </span>
                  ) : (
                    "Ingresar"
                  )}
                </button>
              </div>

              {error && (
                <p className="text-center text-[13px] text-red-400/90">{error}</p>
              )}
            </form>
          </div>

          <p className="mt-10 max-w-md text-center text-[10px] font-medium tracking-[0.2em] text-zinc-500 uppercase sm:text-[11px]">
            © 2026 EvolucionaOS. Crafted for evolution.
          </p>
        </div>
      </div>
    </div>
  )
}
