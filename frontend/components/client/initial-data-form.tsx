"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import { useApp } from "@/lib/app-context"
import { apiFetch } from "@/lib/api"
import { SpaceVioletNebula, StarfieldBackdrop } from "@/components/space/starfield-backdrop"

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
      <StarfieldBackdrop />
      <SpaceVioletNebula />

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
