"use client"

import { useState, useEffect, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"

type DeployInfo = { commit_sha: string; commit_url: string | null }

export function DirectorSettings() {
  const [discordLink, setDiscordLink] = useState("")
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deployInfo, setDeployInfo] = useState<DeployInfo | null>(null)
  const [deployLoadFailed, setDeployLoadFailed] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [discordRes, deployRes] = await Promise.all([
          apiFetch("/settings/discord-link"),
          apiFetch("/settings/deploy-info"),
        ])
        if (discordRes.ok) {
          const data = await discordRes.json()
          setDiscordLink(data.url ?? "")
        }
        if (deployRes.ok) {
          const data = (await deployRes.json()) as DeployInfo
          setDeployInfo(data)
          setDeployLoadFailed(false)
        } else {
          setDeployLoadFailed(true)
        }
      } catch {
        setDeployLoadFailed(true)
      } finally {
        setLoading(false)
      }
    }
    load()
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

  const shortSha = deployInfo?.commit_sha
    ? deployInfo.commit_sha.slice(0, 7)
    : null

  return (
    <div className="flex min-h-full w-full max-w-2xl mx-auto flex-col">
      <h1 className="mb-8 shrink-0 text-2xl font-semibold text-white">Ajustes</h1>

      <div className="shrink-0">
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
                className="h-10 rounded-full border-0 bg-purple-600 px-6 text-white hover:bg-purple-700"
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

      <div className="min-h-8 flex-1" aria-hidden />

      <div className="sticky bottom-0 shrink-0 pb-2 pt-6">
        {cardShell(
          <div className="flex flex-col gap-3">
            {deployLoadFailed ? (
              <p className="text-sm text-zinc-400">
                No se pudo obtener la versión del API. Comprobá que el backend esté
                actualizado.
              </p>
            ) : deployInfo?.commit_sha ? (
              <>
                <p className="text-sm text-zinc-300">
                  Commit del <span className="text-zinc-100">backend</span> en este
                  entorno:
                </p>
                <code className="break-all font-mono text-sm text-emerald-400">
                  {deployInfo.commit_sha}
                </code>
                {deployInfo.commit_url ? (
                  <a
                    href={deployInfo.commit_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit text-sm text-purple-400 underline hover:text-purple-300"
                  >
                    Ver en GitHub ({shortSha})
                  </a>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Definí <span className="font-mono">GITHUB_REPOSITORY</span>{" "}
                    (formato <span className="font-mono">owner/repo</span>) en el
                    servidor para enlazar el commit.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-400">
                No hay SHA configurado. En el deploy, exportá{" "}
                <span className="font-mono text-zinc-300">GIT_COMMIT_SHA</span>{" "}
                (por ejemplo el valor de{" "}
                <span className="font-mono text-zinc-300">GITHUB_SHA</span> en
                GitHub Actions).
              </p>
            )}
          </div>,
          "Versión desplegada (API)"
        )}
      </div>
    </div>
  )
}
