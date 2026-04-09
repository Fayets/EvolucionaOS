"use client"

import { useState, useMemo, startTransition } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRegisteredUsers } from "@/lib/registered-users-context"
import { apiFetch } from "@/lib/api"
import { FilePlus, Search, UserPlus } from "lucide-react"
import { phaseName } from "@/components/director/director-phase-labels"
import { DIRECTOR_TOOLBAR_BUTTON_CLASS } from "@/components/director/director-toolbar-styles"
import { DirectorUserDetailView } from "@/components/director/director-user-detail"

const RegisterUserFormLazy = dynamic(
  () => import("./register-user-form").then(m => m.RegisterUserForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[10rem] items-center justify-center py-6 text-sm text-zinc-500">
        Cargando…
      </div>
    ),
  }
)

const DirectorGenerateTaskLazy = dynamic(
  () => import("./director-generate-task").then(m => m.DirectorGenerateTask),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[12rem] items-center justify-center py-6 text-sm text-zinc-500">
        Cargando…
      </div>
    ),
  }
)

function prefetchUserDialogs() {
  void import("./register-user-form")
  void import("./director-generate-task")
}

/** Orden fijo del filtro (valores en BD / canónicos), alineado al recorrido del programa. */
const PHASE_FILTER_ORDER: readonly string[] = [
  "initial",
  "platforms",
  "Acceso",
  "Onboarding",
  "Base de Negocios",
  "Marketing",
  "Proceso de Ventas",
  "Optimizar",
  "done",
]

/** Una opción por etiqueta visible; orden fijo, sin ordenar alfabéticamente. */
function buildPhaseFilterDropdown(): { value: string; label: string }[] {
  const seen = new Set<string>()
  const out: { value: string; label: string }[] = []
  for (const p of PHASE_FILTER_ORDER) {
    const label = phaseName(p)
    if (seen.has(label)) continue
    seen.add(label)
    out.push({ value: p, label })
  }
  return out
}

const PHASE_FILTER_DROPDOWN = buildPhaseFilterDropdown()

/** Incluye fases que aparecen en datos pero no en el catálogo (legacy); se agregan al final. */
function mergePhaseFilterFromUsers(
  usersList: { clientPhase: string | null }[]
): { value: string; label: string }[] {
  const seenLabels = new Set(PHASE_FILTER_DROPDOWN.map(o => o.label))
  const extra: { value: string; label: string }[] = []
  for (const u of usersList) {
    if (!u.clientPhase) continue
    const label = phaseName(u.clientPhase)
    if (seenLabels.has(label)) continue
    seenLabels.add(label)
    extra.push({ value: u.clientPhase, label })
  }
  extra.sort((a, b) =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" })
  )
  return [...PHASE_FILTER_DROPDOWN, ...extra]
}

function userMatchesPhaseFilter(
  clientPhase: string | null,
  selected: string,
  all: string
): boolean {
  if (selected === all) return true
  if (!clientPhase) return false
  return phaseName(clientPhase) === phaseName(selected)
}

const PHASE_FILTER_ALL = "__all__"

const usersListScrollClass =
  "min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] max-h-[min(22rem,45vh)]"

export function RegisteredUsersList() {
  const { users, removeUser, listLoading, listFetchFailed, refreshFromServer } =
    useRegisteredUsers()
  const [searchQuery, setSearchQuery] = useState("")
  const [phaseFilter, setPhaseFilter] = useState(PHASE_FILTER_ALL)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [viewEmail, setViewEmail] = useState<string | null>(null)

  const handleQuitar = async (user: { id: string; username: string }) => {
    try {
      await apiFetch(`/users/by-email?email=${encodeURIComponent(user.username)}`, { method: "DELETE" })
    } catch {}
    removeUser(user.id)
    if (viewEmail === user.username) setViewEmail(null)
  }

  const phaseFilterItems = useMemo(
    () => mergePhaseFilterFromUsers(users),
    [users]
  )

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return users.filter(u => {
      if (q && !u.username.toLowerCase().includes(q)) return false
      if (!userMatchesPhaseFilter(u.clientPhase, phaseFilter, PHASE_FILTER_ALL))
        return false
      return true
    })
  }, [users, searchQuery, phaseFilter])

  const completedProgramCount = useMemo(
    () => users.filter(u => u.clientPhase === "done").length,
    [users]
  )

  if (viewEmail) {
    return (
      <DirectorUserDetailView
        email={viewEmail}
        onBack={() => setViewEmail(null)}
        onUserMissing={() => {
          const u = users.find(u => u.username === viewEmail)
          if (u) removeUser(u.id)
        }}
      />
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4">
        <div className="relative w-full min-w-0 flex-1 lg:max-w-xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar usuario…"
            className="h-11 border-zinc-700 bg-zinc-950/90 pl-10 text-white placeholder:text-zinc-500"
            autoComplete="off"
          />
        </div>
        <div
          className="flex flex-wrap items-center gap-3"
          onPointerEnter={prefetchUserDialogs}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500 shrink-0">Fase:</span>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="h-10 min-w-[13rem] max-w-[min(100%,18rem)] border-zinc-700 bg-zinc-950/90 text-white text-sm">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="max-h-[min(320px,50vh)] border-zinc-700 bg-zinc-900 text-white overflow-y-auto">
                <SelectItem value={PHASE_FILTER_ALL} className="focus:bg-zinc-800 focus:text-white">
                  Todas
                </SelectItem>
                {phaseFilterItems.map(({ value, label }) => (
                  <SelectItem
                    key={`${value}-${label}`}
                    value={value}
                    className="focus:bg-zinc-800 focus:text-white"
                  >
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            className={DIRECTOR_TOOLBAR_BUTTON_CLASS}
            onClick={() =>
              startTransition(() => {
                setTaskOpen(true)
              })
            }
          >
            <FilePlus className="shrink-0" aria-hidden />
            Tarea a usuario
          </button>
          <button
            type="button"
            className={DIRECTOR_TOOLBAR_BUTTON_CLASS}
            onClick={() =>
              startTransition(() => {
                setRegisterOpen(true)
              })
            }
          >
            <UserPlus className="shrink-0" aria-hidden />
            Usuario
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px] xl:items-start">
        <div className="relative w-full min-w-0">
          <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/40 via-fuchsia-500/40 to-purple-500/40 blur-2xl opacity-50" />
          <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
            <CardHeader className="border-b border-zinc-800 px-6 md:px-8 pb-3">
              <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
                Usuarios registrados
              </p>
            </CardHeader>
            <CardContent className="px-6 md:px-8 py-6">
              {listLoading ? (
                <p className="text-sm text-zinc-500 text-center py-8">Cargando usuarios…</p>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <p className="text-sm text-zinc-500 text-center">
                    {listFetchFailed
                      ? "No se pudo cargar el listado desde el servidor (sesión o conexión). Podés reintentar o revisar que el API esté disponible."
                      : "No hay usuarios clientes registrados todavía."}
                  </p>
                  {listFetchFailed && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 bg-zinc-900 text-xs text-zinc-100 hover:bg-zinc-800"
                      onClick={() => void refreshFromServer()}
                    >
                      Reintentar
                    </Button>
                  )}
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">
                  Ningún usuario coincide con la búsqueda o el filtro de fase.
                </p>
              ) : (
                <ul className={`flex flex-col divide-y divide-zinc-800 ${usersListScrollClass}`}>
                  {filteredUsers.map(user => (
                    <li
                      key={user.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{user.username}</p>
                        <p className="text-xs text-zinc-500">
                          Alta:{" "}
                          {new Date(user.createdAt).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-zinc-300 hover:text-white hover:bg-zinc-800"
                          onClick={() => setViewEmail(user.username)}
                        >
                          Ver
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-zinc-400 hover:text-red-400 hover:bg-zinc-900"
                          onClick={() => handleQuitar(user)}
                        >
                          Quitar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/90 px-4 py-4 text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Total clientes
            </p>
            <p className="mt-2 text-4xl font-semibold tabular-nums">{users.length}</p>
            <p className="mt-1 text-xs text-zinc-500">Listado actual</p>
          </div>
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/90 px-4 py-4 text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Programa completo
            </p>
            <p className="mt-2 text-4xl font-semibold tabular-nums">{completedProgramCount}</p>
            <p className="mt-1 text-xs text-zinc-500">Fase «Programa completo»</p>
          </div>
        </aside>
      </div>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-white !duration-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Registrar usuario</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Alta de usuario en el sistema (mismo flujo que antes en «Registrar»).
            </DialogDescription>
          </DialogHeader>
          <RegisterUserFormLazy
            embedded
            onRegistered={() => {
              setRegisterOpen(false)
              void import("./director-generate-task").then(m =>
                m.invalidateDirectorGenerateClientsCache()
              )
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] w-[calc(100%-2rem)] overflow-y-auto border-zinc-800 bg-zinc-950 text-white !duration-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Tarea a usuario</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Crear una tarea particular para un alumno y una fase.
            </DialogDescription>
          </DialogHeader>
          <DirectorGenerateTaskLazy embedded />
        </DialogContent>
      </Dialog>
    </div>
  )
}
