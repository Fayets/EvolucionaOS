"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { apiFetch, apiUrl } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { AppProvider, useApp } from "@/lib/app-context"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"

const DEFAULT_BROADCAST_MESSAGE =
  "📋 **Reporte Semanal**\n\n¡Hola! Es momento de completar el reporte de esta semana 🗓️\n\n👉 https://evoluciona.cloud/reportes-semanales\n\nPor favor completalo antes de las 23:59 hs. ¡Gracias!"

type KpiField = {
  id: string
  label: string
  type: string
  required: boolean
  options?: string[] | null
}

type KpiTemplate = {
  id: number
  name: string
  fields: KpiField[]
  is_active: boolean
  created_at: string
}

type UserListItem = {
  email: string
  first_name?: string | null
  last_name?: string | null
  discord_webhook_url?: string | null
}

function mondayOfCurrentWeekISO(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  m.setHours(0, 0, 0, 0)
  const y = m.getFullYear()
  const mo = String(m.getMonth() + 1).padStart(2, "0")
  const da = String(m.getDate()).padStart(2, "0")
  return `${y}-${mo}-${da}`
}

async function publicJson<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "same-origin",
  })
  const data = (await res.json().catch(() => null)) as T | null
  return { ok: res.ok, status: res.status, data }
}

/** Evita "Indio Indio" cuando nombre y apellido son el mismo (coincide con el backend). */
function greetingDisplayName(raw: string): string {
  const parts = raw.trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (const p of parts) {
    if (out.length && out[out.length - 1].localeCompare(p, undefined, { sensitivity: "accent" }) === 0) {
      continue
    }
    out.push(p)
  }
  return out.join(" ").trim() || raw.trim()
}

function emptyAnswersForTemplate(tpl: KpiTemplate): Record<string, string | number | boolean> {
  const init: Record<string, string | number | boolean> = {}
  for (const f of tpl.fields || []) {
    if (f.type === "boolean") init[f.id] = false
    else init[f.id] = ""
  }
  return init
}

function ReportesSemanalesPageContent() {
  const { isLoggedIn, userRole } = useApp()
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState("")
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [userName, setUserName] = useState("")

  const [templates, setTemplates] = useState<KpiTemplate[]>([])
  const [noTemplate, setNoTemplate] = useState(false)
  const [weekStart] = useState(() => mondayOfCurrentWeekISO())
  const [loadStep2, setLoadStep2] = useState(false)

  const [answersByTemplate, setAnswersByTemplate] = useState<
    Record<number, Record<string, string | number | boolean>>
  >({})
  const [submissionByTemplate, setSubmissionByTemplate] = useState<
    Record<number, { submitted: boolean; answers?: Record<string, unknown> | null }>
  >({})

  const [submitAllLoading, setSubmitAllLoading] = useState(false)
  const [submitAllError, setSubmitAllError] = useState<string | null>(null)
  const [submitErrorByTemplate, setSubmitErrorByTemplate] = useState<Record<number, string | null>>({})
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false)
  const [broadcastingDiscord, setBroadcastingDiscord] = useState(false)
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState(DEFAULT_BROADCAST_MESSAGE)
  const [broadcastClientsWithWebhook, setBroadcastClientsWithWebhook] = useState<UserListItem[]>([])
  const [broadcastClientsWithoutWebhook, setBroadcastClientsWithoutWebhook] = useState<UserListItem[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set())

  const displayName = (u: UserListItem): string => {
    const first = (u.first_name ?? "").trim()
    const last = (u.last_name ?? "").trim()
    const full = [first, last].filter(Boolean).join(" ").trim()
    return full || u.email
  }

  const loadBroadcastRecipients = useCallback(async () => {
    if (!isLoggedIn || userRole !== "director") return
    setLoadingRecipients(true)
    try {
      const count = 100
      let page = 1
      let total = 0
      const allUsers: UserListItem[] = []
      while (page === 1 || allUsers.length < total) {
        const params = new URLSearchParams({
          role: "CLIENTE",
          page: String(page),
          count: String(count),
          sort: "created_at",
          order: "desc",
        })
        const res = await apiFetch(`/users?${params.toString()}`)
        if (!res.ok) {
          throw new Error(`No se pudo cargar usuarios (${res.status})`)
        }
        const data = (await res.json()) as { total?: number; users?: UserListItem[] }
        const users = Array.isArray(data.users) ? data.users : []
        total = Number(data.total ?? users.length)
        allUsers.push(...users)
        if (users.length === 0) break
        page += 1
      }
      const withWebhook = allUsers.filter(
        u => ((u.discord_webhook_url ?? "").trim().length > 0)
      )
      const withoutWebhook = allUsers.filter(
        u => ((u.discord_webhook_url ?? "").trim().length === 0)
      )
      setBroadcastClientsWithWebhook(withWebhook)
      setBroadcastClientsWithoutWebhook(withoutWebhook)
      setSelectedRecipients(new Set(withWebhook.map(u => u.email)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar destinatarios")
      setBroadcastClientsWithWebhook([])
      setBroadcastClientsWithoutWebhook([])
      setSelectedRecipients(new Set())
    } finally {
      setLoadingRecipients(false)
    }
  }, [isLoggedIn, userRole])

  useEffect(() => {
    if (!broadcastModalOpen) return
    setBroadcastMessage(DEFAULT_BROADCAST_MESSAGE)
    void loadBroadcastRecipients()
  }, [broadcastModalOpen, loadBroadcastRecipients])

  const loadStep2Data = useCallback(async (uid: number) => {
    setLoadStep2(true)
    setNoTemplate(false)
    setTemplates([])
    setAnswersByTemplate({})
    setSubmissionByTemplate({})
    setSubmitErrorByTemplate({})
    setSubmitAllError(null)
    try {
      const tplRes = await fetch(apiUrl("/kpi/public-weekly-templates"), { credentials: "same-origin" })
      if (!tplRes.ok) {
        setNoTemplate(true)
        return
      }
      const list = (await tplRes.json()) as KpiTemplate[]
      if (!Array.isArray(list) || list.length === 0) {
        setNoTemplate(true)
        return
      }
      setTemplates(list)

      const nextAnswers: Record<number, Record<string, string | number | boolean>> = {}
      const nextSub: Record<number, { submitted: boolean; answers?: Record<string, unknown> | null }> = {}

      for (const tpl of list) {
        nextAnswers[tpl.id] = emptyAnswersForTemplate(tpl)
        const sub = await publicJson<{ submitted: boolean; answers?: Record<string, unknown> | null }>(
          `/kpi/week-submission?user_id=${uid}&week_start=${weekStart}&template_id=${tpl.id}`
        )
        if (sub.ok && sub.data?.submitted) {
          nextSub[tpl.id] = {
            submitted: true,
            answers:
              sub.data.answers && typeof sub.data.answers === "object"
                ? (sub.data.answers as Record<string, unknown>)
                : {},
          }
        } else {
          nextSub[tpl.id] = { submitted: false, answers: null }
        }
      }

      setAnswersByTemplate(nextAnswers)
      setSubmissionByTemplate(nextSub)
    } finally {
      setLoadStep2(false)
    }
  }, [weekStart])

  useEffect(() => {
    if (step === 2 && userId != null) {
      void loadStep2Data(userId)
    }
  }, [step, userId, loadStep2Data])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyError(null)
    setVerifyLoading(true)
    try {
      const { ok, data } = await publicJson<{
        exists: boolean
        user_id?: number | null
        user_name?: string | null
      }>("/kpi/verify-email", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!ok || !data?.exists || data.user_id == null) {
        setVerifyError("no-exists")
        return
      }
      setUserId(data.user_id)
      const fromApi = (data.user_name || "").trim()
      setUserName(greetingDisplayName(fromApi) || email.trim())
      setStep(2)
    } catch {
      setVerifyError("network")
    } finally {
      setVerifyLoading(false)
    }
  }

  const setFieldForTemplate = (templateId: number, fieldId: string, value: string | number | boolean) => {
    setAnswersByTemplate((prev) => ({
      ...prev,
      [templateId]: { ...prev[templateId], [fieldId]: value },
    }))
  }

  function buildPayloadAnswers(
    template: KpiTemplate,
    answers: Record<string, string | number | boolean>
  ): Record<string, unknown> {
    const payloadAnswers: Record<string, unknown> = { ...answers }
    for (const f of template.fields || []) {
      if (f.type === "number") {
        const raw = payloadAnswers[f.id]
        if (raw === "" || raw == null) payloadAnswers[f.id] = ""
        else payloadAnswers[f.id] = typeof raw === "number" ? raw : Number(raw)
      }
    }
    return payloadAnswers
  }

  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (userId == null) return
    setSubmitAllError(null)
    setSubmitErrorByTemplate({})
    const pending = templates.filter((t) => !submissionByTemplate[t.id]?.submitted)
    if (pending.length === 0) return

    setSubmitAllLoading(true)
    try {
      for (const template of pending) {
        const tid = template.id
        const payloadAnswers = buildPayloadAnswers(template, { ...answersByTemplate[tid] })
        const res = await fetch(apiUrl("/kpi/submit"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            user_id: userId,
            template_id: tid,
            week_start: weekStart,
            answers: payloadAnswers,
          }),
        })
        if (res.status === 409) {
          setSubmitErrorByTemplate((prev) => ({ ...prev, [tid]: "duplicate" }))
          setSubmissionByTemplate((prev) => ({
            ...prev,
            [tid]: { submitted: true, answers: payloadAnswers as Record<string, unknown> },
          }))
          continue
        }
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          const detail = typeof err?.detail === "string" ? err.detail : "No se pudo enviar."
          setSubmitErrorByTemplate((prev) => ({ ...prev, [tid]: detail }))
          setSubmitAllError(
            `No se pudo guardar «${template.name}». ${detail} Corregí ese bloque y volvé a intentar.`
          )
          return
        }
        setSubmissionByTemplate((prev) => ({
          ...prev,
          [tid]: { submitted: true, answers: payloadAnswers as Record<string, unknown> },
        }))
      }
    } catch {
      setSubmitAllError("Error de red. Intentá de nuevo.")
    } finally {
      setSubmitAllLoading(false)
    }
  }

  const renderField = (
    templateId: number,
    f: KpiField,
    previewValues: Record<string, string | number | boolean>,
    readOnly?: boolean
  ) => {
    const v = previewValues[f.id]
    const ro = readOnly ?? false
    const domId = `kpi-${templateId}-${f.id}`
    if (f.type === "textarea") {
      return (
        <Textarea
          id={domId}
          value={typeof v === "string" ? v : String(v ?? "")}
          onChange={(e) => !ro && setFieldForTemplate(templateId, f.id, e.target.value)}
          required={f.required && !ro}
          readOnly={ro}
          className="min-h-[72px] resize-y border-zinc-700 bg-zinc-950 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-zinc-500/25"
        />
      )
    }
    if (f.type === "number") {
      return (
        <Input
          id={domId}
          type="number"
          value={v === "" || v == null ? "" : String(v)}
          onChange={(e) =>
            !ro && setFieldForTemplate(templateId, f.id, e.target.value === "" ? "" : e.target.value)
          }
          required={f.required && !ro}
          readOnly={ro}
          className="h-9 border-zinc-700 bg-zinc-950 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-zinc-500/25"
        />
      )
    }
    if (f.type === "select" && f.options?.length) {
      return (
        <Select
          value={typeof v === "string" && v ? v : undefined}
          onValueChange={(val) => !ro && setFieldForTemplate(templateId, f.id, val)}
          disabled={ro}
          required={f.required && !ro}
        >
          <SelectTrigger className="h-9 w-full border-zinc-700 bg-zinc-950 text-sm text-zinc-100 focus:ring-zinc-500/25">
            <SelectValue placeholder="Elegí una opción" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-950 text-zinc-100">
            {f.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    if (f.type === "boolean") {
      return (
        <div className="flex items-center gap-3">
          <Switch
            checked={!!v}
            onCheckedChange={(c) => !ro && setFieldForTemplate(templateId, f.id, c)}
            disabled={ro}
          />
          <span className="text-sm text-zinc-400">{v ? "Sí" : "No"}</span>
        </div>
      )
    }
    return (
      <Input
        id={domId}
        value={typeof v === "string" ? v : String(v ?? "")}
        onChange={(e) => !ro && setFieldForTemplate(templateId, f.id, e.target.value)}
        required={f.required && !ro}
        readOnly={ro}
        className="h-9 border-zinc-700 bg-zinc-950 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-zinc-500/25"
      />
    )
  }

  const handleBroadcastWeeklyReport = async () => {
    if (!isLoggedIn || userRole !== "director") return
    const recipients = Array.from(selectedRecipients)
    if (recipients.length === 0) return
    setBroadcastingDiscord(true)
    try {
      const res = await apiFetch("/discord/difundir-reportes", {
        method: "POST",
        body: JSON.stringify({
          mensaje: broadcastMessage,
          destinatarios: recipients,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        enviados?: number
        errores?: Array<{ email?: string; error?: string }>
        detail?: string
      }
      if (!res.ok) {
        toast.error(
          typeof data.detail === "string"
            ? data.detail
            : "No se pudo difundir el reporte semanal."
        )
        return
      }
      const enviados = Number(data.enviados ?? 0)
      const errores = Array.isArray(data.errores) ? data.errores : []
      if (errores.length > 0) {
        toast.error(`Se enviaron ${enviados} y hubo ${errores.length} errores.`)
        setBroadcastModalOpen(false)
        return
      }
      toast.success(`Enviado a ${enviados} clientes`)
      setBroadcastModalOpen(false)
    } catch {
      toast.error("Error de conexión al difundir el reporte semanal.")
    } finally {
      setBroadcastingDiscord(false)
    }
  }

  return (
    <div className="min-h-dvh bg-black px-4 py-10 text-white">
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-8",
          step === 2 ? "max-w-7xl" : "max-w-lg items-center"
        )}
      >
        <div className="flex w-full justify-center">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="relative h-14 w-48 shrink-0">
              <Image
                src="/EvolucionaLogoLogin.png"
                alt="Evoluciona"
                fill
                className="object-contain object-center brightness-0 invert"
                priority
                sizes="192px"
              />
            </div>
            {isLoggedIn && userRole === "director" ? (
              <Button
                type="button"
                onClick={() => setBroadcastModalOpen(true)}
                className="bg-violet-700 text-white hover:bg-violet-600"
              >
                Enviar reportes a todos los usuarios
              </Button>
            ) : null}
          </div>
        </div>

        <Dialog open={broadcastModalOpen} onOpenChange={setBroadcastModalOpen}>
          <DialogContent className="border-zinc-800 bg-zinc-950 text-white sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Difundir reporte semanal</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Editá el mensaje y seleccioná los destinatarios con webhook de Discord.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="broadcast-message" className="text-zinc-300">
                  Mensaje
                </Label>
                <Textarea
                  id="broadcast-message"
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  rows={7}
                  className="border-zinc-700 bg-zinc-900 text-zinc-100"
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-zinc-300">Destinatarios</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                      onClick={() =>
                        setSelectedRecipients(new Set(broadcastClientsWithWebhook.map(u => u.email)))
                      }
                      disabled={loadingRecipients || broadcastClientsWithWebhook.length === 0}
                    >
                      Seleccionar todos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                      onClick={() => setSelectedRecipients(new Set())}
                      disabled={loadingRecipients || selectedRecipients.size === 0}
                    >
                      Deseleccionar todos
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[320px] rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="space-y-2">
                    {loadingRecipients ? (
                      <div className="flex items-center justify-center py-8 text-zinc-400">
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Cargando clientes...
                      </div>
                    ) : (
                      <>
                        {broadcastClientsWithWebhook.map((u) => {
                          const checked = selectedRecipients.has(u.email)
                          return (
                            <label
                              key={`with-${u.email}`}
                              className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm text-zinc-100">{displayName(u)}</p>
                                <p className="truncate text-xs text-zinc-500">{u.email}</p>
                              </div>
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  setSelectedRecipients((prev) => {
                                    const next = new Set(prev)
                                    if (v) next.add(u.email)
                                    else next.delete(u.email)
                                    return next
                                  })
                                }}
                                className="border-zinc-600 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                              />
                            </label>
                          )
                        })}

                        {broadcastClientsWithoutWebhook.length > 0 ? (
                          <>
                            <p className="pt-2 text-xs uppercase tracking-wide text-zinc-500">
                              Sin webhook
                            </p>
                            {broadcastClientsWithoutWebhook.map((u) => (
                              <div
                                key={`without-${u.email}`}
                                className="flex items-center justify-between rounded-md border border-zinc-900 bg-zinc-950/40 px-3 py-2 opacity-70"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm text-zinc-400">{displayName(u)}</p>
                                  <p className="truncate text-xs text-zinc-600">{u.email}</p>
                                </div>
                                <span className="text-[11px] text-zinc-500">
                                  Sin webhook configurado
                                </span>
                              </div>
                            ))}
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => void handleBroadcastWeeklyReport()}
                disabled={broadcastingDiscord || selectedRecipients.size === 0 || loadingRecipients}
                className="bg-violet-700 text-white hover:bg-violet-600 disabled:opacity-40"
              >
                {broadcastingDiscord ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  `Enviar a ${selectedRecipients.size} seleccionados`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {step === 1 ? (
          <Card className="w-full border-zinc-800 bg-zinc-950/90 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg text-white">Reporte semanal</CardTitle>
              <CardDescription className="text-zinc-400">
                Ingresá el email con el que estás registrado en Evoluciona.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-zinc-300">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-zinc-700 bg-black/60 text-white"
                    placeholder="nombre@ejemplo.com"
                  />
                </div>
                {verifyError === "no-exists" && (
                  <Badge variant="destructive">Este email no está registrado</Badge>
                )}
                {verifyError === "network" && (
                  <Badge variant="destructive">No se pudo conectar. Intentá de nuevo.</Badge>
                )}
                <Button
                  type="submit"
                  disabled={verifyLoading}
                  className="w-full bg-violet-600 text-white hover:bg-violet-500"
                >
                  {verifyLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Verificando…
                    </span>
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="flex w-full flex-col gap-6">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-lg font-semibold text-white sm:text-xl">
                Hola {userName}, completá tus reportes de esta semana
              </h1>
              <p className="mt-1 text-xs text-zinc-500">Semana que inicia el {weekStart}</p>
            </div>

            {loadStep2 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-8 animate-spin text-violet-400" />
              </div>
            ) : noTemplate ? (
              <Card className="border-amber-900/40 bg-zinc-950/90">
                <CardContent className="py-8 text-center text-sm text-zinc-400">
                  Por el momento no hay formularios de reporte configurados. Volvé más tarde o consultá con tu contacto
                  en Evoluciona.
                </CardContent>
              </Card>
            ) : (
              <form
                onSubmit={(ev) => void handleSubmitAll(ev)}
                className="flex w-full flex-col gap-6"
              >
                <div
                  className={cn(
                    "grid w-full grid-cols-1 gap-6",
                    templates.length > 1 && "lg:grid-cols-2 lg:items-stretch"
                  )}
                >
                  {templates.map((template) => {
                    const submitted = !!submissionByTemplate[template.id]?.submitted
                    const existingAnswers = submissionByTemplate[template.id]?.answers ?? null
                    const preview = answersByTemplate[template.id] ?? {}
                    const err = submitErrorByTemplate[template.id]

                    return (
                      <Card
                        key={template.id}
                        className="flex min-h-0 min-w-0 flex-col border-zinc-800 bg-zinc-900/90 text-zinc-100 shadow-lg ring-1 ring-zinc-800/60"
                      >
                        <CardHeader className="shrink-0 space-y-1 border-b border-zinc-800 pb-4">
                          <CardTitle className="text-base font-semibold text-zinc-100">{template.name}</CardTitle>
                          {submitted ? (
                            <CardDescription className="text-zinc-500">
                              Ya enviaste este formulario esta semana
                            </CardDescription>
                          ) : null}
                        </CardHeader>
                        <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col pt-6">
                          {submitted ? (
                            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                              {(template.fields || []).map((f) => {
                                const raw = existingAnswers?.[f.id]
                                const display =
                                  typeof raw === "boolean"
                                    ? raw
                                      ? "Sí"
                                      : "No"
                                    : raw == null || raw === ""
                                      ? "—"
                                      : String(raw)
                                return (
                                  <div
                                    key={f.id}
                                    className={cn(
                                      "border-b border-zinc-800 pb-3 last:border-0 last:pb-0 sm:border-0 sm:pb-0",
                                      f.type === "textarea" && "sm:col-span-2"
                                    )}
                                  >
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                                      {f.label}
                                    </p>
                                    <p className="mt-1 text-sm text-zinc-200 whitespace-pre-wrap">{display}</p>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
                              <div className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                {(template.fields || []).map((f) => {
                                  const domId = `kpi-${template.id}-${f.id}`
                                  return (
                                    <div
                                      key={f.id}
                                      className={cn(
                                        "min-w-0 space-y-1.5",
                                        f.type === "textarea" && "sm:col-span-2"
                                      )}
                                    >
                                      <Label htmlFor={domId} className="text-xs font-medium text-zinc-400">
                                        {f.label}
                                        {f.required ? <span className="text-red-400"> *</span> : null}
                                      </Label>
                                      {renderField(template.id, f, preview, false)}
                                    </div>
                                  )
                                })}
                              </div>
                              {err && err !== "duplicate" && (
                                <p className="text-center text-sm text-red-400">{err}</p>
                              )}
                              {err === "duplicate" && (
                                <Badge variant="destructive" className="mx-auto">
                                  Ya habías enviado el reporte de esta semana para este formulario.
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {submitAllError ? (
                  <p className="text-center text-sm text-red-400">{submitAllError}</p>
                ) : null}

                <div className="mx-auto w-full max-w-lg">
                  <Button
                    type="submit"
                    disabled={
                      submitAllLoading ||
                      templates.length === 0 ||
                      templates.every((t) => submissionByTemplate[t.id]?.submitted)
                    }
                    className="w-full bg-violet-800 text-zinc-100 hover:bg-violet-700 disabled:opacity-40"
                  >
                    {submitAllLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Enviando…
                      </span>
                    ) : templates.every((t) => submissionByTemplate[t.id]?.submitted) ? (
                      "Reportes ya enviados esta semana"
                    ) : (
                      "Enviar reportes de la semana"
                    )}
                  </Button>
                  <p className="mt-2 text-center text-xs text-zinc-500">
                    Se guardan el KPI de ventas y el de marketing juntos (solo los que aún no enviaste).
                  </p>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReportesSemanalesPage() {
  return (
    <AppProvider>
      <ReportesSemanalesPageContent />
      <Toaster />
    </AppProvider>
  )
}
