"use client"

import { useState, useEffect, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"

type DeployInfo = { commit_sha: string; commit_url: string | null }
type PhaseImagesMap = Record<string, string>

const PHASE_IMAGE_FIELDS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: "Acceso", label: "Acceso", placeholder: "/phases/acceso.jpg" },
  { key: "Onboarding", label: "Onboarding", placeholder: "/phases/onboarding.jpg" },
  { key: "Base de Negocios", label: "Base de negocio", placeholder: "/phases/base-de-negocio.jpg" },
  { key: "Marketing", label: "Marketing", placeholder: "/phases/marketing.jpg" },
  { key: "Proceso de Ventas", label: "Proceso de ventas", placeholder: "/phases/proceso-de-ventas.jpg" },
  { key: "Optimizar", label: "Optimizar", placeholder: "/phases/optimizar.jpg" },
]

function cardShell(children: ReactNode, title: string) {
  return (
    <div className="relative w-full min-w-0">
      <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-500/25 via-fuchsia-500/20 to-violet-500/25 blur-2xl opacity-60" />
      <Card
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-violet-500/15 bg-gradient-to-br from-zinc-950 via-black to-zinc-950",
          "text-white shadow-[0_0_48px_-12px_rgba(88,28,135,0.35)]"
        )}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-violet-600/10 blur-3xl" />
        <CardHeader className="relative border-b border-zinc-800/90 px-6 pb-3 pt-6 md:px-8">
          <p className="inline-flex max-w-fit rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-200">
            {title}
          </p>
        </CardHeader>
        <CardContent className="relative px-6 pb-8 pt-5 text-white md:px-8">
          {children}
        </CardContent>
      </Card>
    </div>
  )
}

export function DirectorSettings() {
  const [discordLink, setDiscordLink] = useState("")
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [phaseImages, setPhaseImages] = useState<PhaseImagesMap>({})
  const [phaseSaved, setPhaseSaved] = useState(false)
  const [deployInfo, setDeployInfo] = useState<DeployInfo | null>(null)
  const [deployLoadFailed, setDeployLoadFailed] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [discordRes, deployRes, phaseImagesRes] = await Promise.all([
          apiFetch("/settings/discord-link"),
          apiFetch("/settings/deploy-info"),
          apiFetch("/settings/phase-images"),
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
        if (phaseImagesRes.ok) {
          const data = (await phaseImagesRes.json()) as { images?: PhaseImagesMap }
          setPhaseImages(data.images ?? {})
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

  const handleSavePhaseImages = async (e: React.FormEvent) => {
    e.preventDefault()
    setPhaseSaved(false)
    try {
      const payload: PhaseImagesMap = {}
      for (const field of PHASE_IMAGE_FIELDS) {
        payload[field.key] = phaseImages[field.key] ?? ""
      }
      const res = await apiFetch("/settings/phase-images", {
        method: "PUT",
        body: JSON.stringify({ images: payload }),
      })
      if (res.ok) setPhaseSaved(true)
    } catch {
      // ignorar
    }
  }

  const shortSha = deployInfo?.commit_sha
    ? deployInfo.commit_sha.slice(0, 7)
    : null

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center py-20">
        <p className="text-sm text-zinc-500">Cargando ajustes…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl pb-12">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {cardShell(
          <form onSubmit={handleSave} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="discord-link" className="text-sm text-zinc-300">
                Link de Discord para clientes
              </Label>
              <Input
                id="discord-link"
                type="url"
                value={discordLink}
                onChange={e => setDiscordLink(e.target.value)}
                placeholder="https://discord.gg/..."
                className="h-11 border-zinc-700 bg-zinc-900/90 text-white placeholder:text-zinc-500 focus-visible:ring-violet-500/40"
              />
              <p className="text-xs leading-relaxed text-zinc-500">
                Este enlace se muestra cuando el cliente pulsa «Ingresar a Discord» en accesos a
                plataformas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                className="h-10 rounded-md border-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 text-white shadow-[0_0_20px_-8px_rgba(139,92,246,0.55)] hover:from-violet-500 hover:to-fuchsia-500"
              >
                Guardar
              </Button>
              {saved ? (
                <span className="text-sm text-emerald-400">Guardado correctamente.</span>
              ) : null}
            </div>
          </form>,
          "Link de Discord"
        )}

        {cardShell(
          <form onSubmit={handleSavePhaseImages} className="flex flex-col gap-4">
            {PHASE_IMAGE_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-2">
                <Label htmlFor={`phase-image-${field.key}`} className="text-sm text-zinc-300">
                  Imagen de {field.label}
                </Label>
                <Input
                  id={`phase-image-${field.key}`}
                  type="text"
                  value={phaseImages[field.key] ?? ""}
                  onChange={(e) =>
                    setPhaseImages((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  className="h-11 border-zinc-700 bg-zinc-900/90 text-white placeholder:text-zinc-500 focus-visible:ring-violet-500/40"
                />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                type="submit"
                className="h-10 rounded-md border-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 text-white shadow-[0_0_20px_-8px_rgba(139,92,246,0.55)] hover:from-violet-500 hover:to-fuchsia-500"
              >
                Guardar imagenes
              </Button>
              {phaseSaved ? (
                <span className="text-sm text-emerald-400">Guardado correctamente.</span>
              ) : null}
            </div>
          </form>,
          "Imagenes de fases"
        )}

        {cardShell(
          <div className="flex flex-col gap-4">
            {deployLoadFailed ? (
              <p className="text-sm text-zinc-400">
                No se pudo obtener la versión del API. Comprobá que el backend esté actualizado.
              </p>
            ) : deployInfo?.commit_sha ? (
              <>
                <p className="text-sm text-zinc-400">
                  Commit del <span className="text-zinc-200">backend</span> en este entorno:
                </p>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
                  <code className="break-all font-mono text-[13px] text-violet-300/95">
                    {deployInfo.commit_sha}
                  </code>
                </div>
                {deployInfo.commit_url ? (
                  <a
                    href={deployInfo.commit_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit text-sm font-medium text-violet-300 underline-offset-4 hover:text-fuchsia-300 hover:underline"
                  >
                    Ver en GitHub ({shortSha})
                  </a>
                ) : (
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Definí <span className="font-mono text-zinc-400">GITHUB_REPOSITORY</span>{" "}
                    (<span className="font-mono">owner/repo</span>) en el servidor para enlazar el
                    commit.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm leading-relaxed text-zinc-400">
                No hay SHA configurado. En el deploy, exportá{" "}
                <span className="font-mono text-zinc-300">GIT_COMMIT_SHA</span> (por ejemplo{" "}
                <span className="font-mono text-zinc-300">GITHUB_SHA</span> en GitHub Actions).
              </p>
            )}
          </div>,
          "Versión desplegada (API)"
        )}
      </div>
    </div>
  )
}
