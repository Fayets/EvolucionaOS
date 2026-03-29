"use client"

import { useState, useEffect, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"

export function DirectorSettings() {
  const [discordLink, setDiscordLink] = useState("")
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLink = async () => {
      try {
        const res = await apiFetch("/settings/discord-link")
        if (res.ok) {
          const data = await res.json()
          setDiscordLink(data.url ?? "")
        }
      } catch {
        // ignorar
      } finally {
        setLoading(false)
      }
    }
    fetchLink()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    try {
      const res = await apiFetch("/settings/discord-link", {
        method: "PUT",
        body: JSON.stringify({ url: discordLink.trim() || "" }),
      })
      if (res.ok) setSaved(true)
    } catch {
      // ignorar
    }
  }

  const cardShell = (children: ReactNode, title: string) => (
    <div className="relative w-full">
      <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/40 via-fuchsia-500/40 to-purple-500/40 blur-2xl opacity-50" />
      <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
        <CardHeader className="pb-2 border-b border-zinc-800 px-6 md:px-8">
          <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
            {title}
          </p>
        </CardHeader>
        <CardContent className="pt-4 px-6 md:px-8 pb-6 text-white">
          {children}
        </CardContent>
      </Card>
    </div>
  )

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto flex items-center justify-center py-12">
        <p className="text-zinc-500">Cargando ajustes...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold text-white mb-8">Ajustes</h1>

      {cardShell(
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="discord-link" className="text-zinc-200">
              Link de Discord para clientes
            </Label>
            <Input
              id="discord-link"
              type="url"
              value={discordLink}
              onChange={(e) => setDiscordLink(e.target.value)}
              placeholder="https://discord.gg/..."
              className="h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            <p className="text-xs text-zinc-500">
              Este enlace se mostrará cuando el cliente haga clic en &quot;Ingresar a
              Discord&quot; en la vista de accesos a plataformas.
            </p>
            <p className="text-xs text-zinc-500">
              Las tareas predeterminadas por fase se gestionan en el menú «Fases».
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              className="h-10 px-6 bg-purple-600 hover:bg-purple-700 text-white rounded-full border-0"
            >
              Guardar
            </Button>
            {saved && (
              <span className="text-sm text-emerald-400">Guardado correctamente.</span>
            )}
          </div>
        </form>,
        "Link de Discord"
      )}
    </div>
  )
}
