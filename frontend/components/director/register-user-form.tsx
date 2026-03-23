"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRegisteredUsers } from "@/lib/registered-users-context"
import { apiUrl } from "@/lib/api"

type RoleOption = "SISTEMAS" | "MARKETING" | "VENTAS" | "DELIVERY" | "CLIENTE"

export function RegisterUserForm() {
  const { registerUser } = useRegisteredUsers()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [role, setRole] = useState<RoleOption>("CLIENTE")
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)

    try {
      const res = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          role,
          firstName: firstName || null,
          lastName: lastName || null,
          username: null,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.success) {
        setMessage({
          type: "err",
          text:
            typeof data?.message === "string"
              ? data.message
              : "No se pudo registrar el usuario.",
        })
        return
      }

      // También lo agregamos al listado local de usuarios registrados
      registerUser(email, password)

      setMessage({ type: "ok", text: "Usuario registrado correctamente." })
      setEmail("")
      setPassword("")
      setFirstName("")
      setLastName("")
      setRole("CLIENTE")
    } catch {
      setMessage({
        type: "err",
        text: "Error de conexión con el servidor.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/40 via-fuchsia-500/40 to-purple-500/40 blur-2xl opacity-50" />
      <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
        <CardHeader className="border-b border-zinc-800 px-6 md:px-8 pb-3">
          <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
            Registrar usuario
          </p>
        </CardHeader>
        <CardContent className="px-6 md:px-8 py-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-firstname" className="text-sm text-zinc-300">
                Nombre
              </Label>
              <Input
                id="reg-firstname"
                value={firstName}
                onChange={e => {
                  const value = e.target.value
                  setFirstName(value)
                  if (value) {
                    setEmail(`${value.toLowerCase()}@${role.toLowerCase()}.com`)
                  } else {
                    setEmail("")
                  }
                }}
                placeholder="Nombre"
                className="h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-lastname" className="text-sm text-zinc-300">
                Apellido
              </Label>
              <Input
                id="reg-lastname"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Apellido"
                className="h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-role" className="text-sm text-zinc-300">
                Rol
              </Label>
              <select
                id="reg-role"
                value={role}
                onChange={e => {
                  const value = e.target.value as RoleOption
                  setRole(value)
                  if (firstName) {
                    setEmail(`${firstName.toLowerCase()}@${value.toLowerCase()}.com`)
                  }
                }}
                className="h-11 rounded-md bg-zinc-900 border border-zinc-700 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <option value="CLIENTE">CLIENTE</option>
                <option value="SISTEMAS">SISTEMAS</option>
                <option value="MARKETING">MARKETING</option>
                <option value="VENTAS">VENTAS</option>
                <option value="DELIVERY">DELIVERY</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-email" className="text-sm text-zinc-300">
                Email
              </Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={email}
                readOnly
                placeholder="nombre@rol.com"
                className="h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-password" className="text-sm text-zinc-300">
                Contraseña
              </Label>
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
                required
              />
            </div>
            {message && (
              <p
                className={
                  message.type === "ok"
                    ? "text-sm text-emerald-400"
                    : "text-sm text-red-400"
                }
              >
                {message.text}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-zinc-900 border border-zinc-600 text-white rounded-full hover:bg-zinc-800 hover:border-zinc-400 disabled:opacity-50"
            >
              {loading ? "Registrando..." : "Registrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
