"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useApp } from "@/lib/app-context"
import { apiFetch } from "@/lib/api"

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-transparent px-4 py-10 text-white">
      <div className="flex flex-col items-center gap-6 w-full max-w-xl">
        <Image
          src="/EvolucionaLogoLogin.png"
          alt="Evoluciona"
          width={160}
          height={160}
        />

        <p className="text-center text-2xl">
          Bienvenido {displayName} a Evoluciona!
        </p>

        <div className="mt-6 w-full">
          <div className="max-w-md mx-auto rounded-2xl bg-black/80 border border-zinc-800 px-6 py-7 shadow-[0_0_40px_rgba(0,0,0,0.9)]">
            <p className="text-lg mb-4">Completa los siguientes campos:</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone" className="text-sm text-gray-200">
                  Numero de celular
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54 11 1234 5678"
                  required
                  className="h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-sm text-gray-200">
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email || userEmail}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Será usado para conceder acceso a Skool"
                  required
                  className="h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 mt-1 text-center">{error}</p>
              )}

              <div className="mt-4 flex justify-end">
                <Button
                  type="submit"
                  className="px-8 h-11 bg-zinc-900 border border-zinc-600 text-white rounded-full hover:bg-zinc-800 hover:border-zinc-400 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                >
                  CONTINUAR
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
