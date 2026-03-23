"use client"

import { useState } from "react"
import Image from "next/image"
import { useApp, type UserRole } from "@/lib/app-context"
import { apiUrl, setToken } from "@/lib/api"

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
        strokeOpacity="0.2"
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
    // Guardar token antes del siguiente render: si no, useEffects hijos (lista usuarios, etc.) hacen fetch sin Authorization → 401.
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

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: "#060606" }}>
      {/* Subtle white spotlight */}
      <div
        className="pointer-events-none absolute"
        style={{
          width: "800px",
          height: "600px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(ellipse at center, rgba(255, 255, 255, 0.03) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />

      {/* Noise grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      <div className="animate-login-enter flex flex-col items-center px-4 w-full max-w-[380px] relative z-10">
        {/* Logo */}
        <Image
          src="/EvolucionaLogoLogin.png"
          alt="Evoluciona"
          width={140}
          height={140}
          priority
        />
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="login-email"
              className="text-[13px] font-medium pl-1"
              style={{ color: "#777" }}
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
              className="h-12 w-full rounded-[14px] px-4 text-[15px] font-medium outline-none transition-all duration-200"
              style={{
                color: "#eaeaea",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                boxShadow: "0 6px 24px -4px rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(4px)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.14)"
                e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 16px rgba(255, 255, 255, 0.03), 0 6px 24px -4px rgba(0, 0, 0, 0.5)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)"
                e.currentTarget.style.boxShadow = "0 6px 24px -4px rgba(0, 0, 0, 0.5)"
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="login-password"
              className="text-[13px] font-medium pl-1"
              style={{ color: "#777" }}
            >
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-[14px] px-4 text-[15px] font-medium outline-none transition-all duration-200"
              style={{
                color: "#eaeaea",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                boxShadow: "0 6px 24px -4px rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(4px)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.14)"
                e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 16px rgba(255, 255, 255, 0.03), 0 6px 24px -4px rgba(0, 0, 0, 0.5)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)"
                e.currentTarget.style.boxShadow = "0 6px 24px -4px rgba(0, 0, 0, 0.5)"
              }}
            />
          </div>

          {/* Submit */}
          <div className="relative mt-3">
            <div
              className="pointer-events-none absolute inset-x-8 -bottom-1 h-8 transition-all duration-200"
              style={{
                background: "radial-gradient(ellipse at center, rgba(0, 0, 0, 0.5) 0%, transparent 70%)",
                filter: "blur(16px)",
              }}
              id="btn-glow"
            />
            <button
              type="submit"
              disabled={loading}
              className="relative w-full h-[52px] cursor-pointer rounded-2xl text-[15px] font-semibold outline-none disabled:pointer-events-none disabled:opacity-60"
              style={{
                color: "#e0e0e0",
                background: "linear-gradient(180deg, #1a1a1e 0%, #131315 50%, #0d0d0f 100%)",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.6), 0 8px 32px -4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.07), inset 0 -1px 0 rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                transform: "translateY(0)",
                transition: "transform 200ms cubic-bezier(0.33, 1, 0.68, 1), box-shadow 200ms ease, filter 200ms ease, border-color 200ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)"
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"
                e.currentTarget.style.boxShadow = "0 8px 28px rgba(0, 0, 0, 0.6), 0 12px 44px -4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.09), inset 0 -1px 0 rgba(0, 0, 0, 0.3)"
                const glow = e.currentTarget.parentElement?.querySelector("#btn-glow") as HTMLElement | null
                if (glow) { glow.style.opacity = "1.3"; glow.style.filter = "blur(20px)" }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)"
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.6), 0 8px 32px -4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.07), inset 0 -1px 0 rgba(0, 0, 0, 0.3)"
                const glow = e.currentTarget.parentElement?.querySelector("#btn-glow") as HTMLElement | null
                if (glow) { glow.style.opacity = "1"; glow.style.filter = "blur(16px)" }
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "translateY(1px)"
                const glow = e.currentTarget.parentElement?.querySelector("#btn-glow") as HTMLElement | null
                if (glow) { glow.style.opacity = "0.6"; glow.style.filter = "blur(12px)" }
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)"
                const glow = e.currentTarget.parentElement?.querySelector("#btn-glow") as HTMLElement | null
                if (glow) { glow.style.opacity = "1.3"; glow.style.filter = "blur(20px)" }
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  <span>Ingresando…</span>
                </span>
              ) : (
                "Ingresar"
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-[13px] text-red-400/80 text-center">
              {error}
            </p>
          )}
        </form>

        {/* Footer */}
        <p className="mt-10 text-center text-[12px] tracking-wide" style={{ color: "#444" }}>
          Acceso seguro · Evoluciona OS
        </p>
      </div>
    </div>
  )
}
