"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/lib/app-context"
import {
  BarChart2,
  ChevronRight,
  FileStack,
  LayoutDashboard,
  LayoutGrid,
  Table2,
  Users,
  Settings,
  LogOut,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type DirectorViewId =
  | "tasks"
  | "users"
  | "phases"
  | "kpi"
  | "kpi-formularios"
  | "settings"

type DirectorSidebarProps = {
  active: DirectorViewId
  onNavigate: (view: DirectorViewId) => void
}

const mainNavItems: { id: Exclude<DirectorViewId, "kpi" | "kpi-formularios">; label: string; icon: LucideIcon }[] = [
  { id: "tasks", label: "Inicio", icon: LayoutDashboard },
  { id: "users", label: "Usuarios", icon: Users },
  { id: "phases", label: "Fases", icon: LayoutGrid },
]

function NavButton({
  active,
  icon: Icon,
  label,
  onClick,
  compact,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] outline-none transition-all duration-150 cursor-pointer ${
        compact ? "pl-2 text-[13px]" : ""
      }`}
      style={{
        color: active ? "#e0e0e0" : "#666",
        fontWeight: active ? 500 : 400,
        background: active ? "rgba(255, 255, 255, 0.05)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"
          e.currentTarget.style.color = "#aaa"
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent"
          e.currentTarget.style.color = "#666"
        }
      }}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full"
          style={{ background: "rgba(255, 255, 255, 0.3)" }}
        />
      )}
      <Icon size={compact ? 15 : 16} strokeWidth={active ? 2 : 1.5} className={`shrink-0 ${compact ? "ml-0.5" : "ml-1"}`} />
      {label}
    </button>
  )
}

export function DirectorSidebar({ active, onNavigate }: DirectorSidebarProps) {
  const { logout } = useApp()
  const kpiActive = active === "kpi" || active === "kpi-formularios"
  const [kpiOpen, setKpiOpen] = useState(kpiActive)

  useEffect(() => {
    if (kpiActive) setKpiOpen(true)
  }, [kpiActive])

  return (
    <aside
      className="relative hidden min-h-0 w-56 shrink-0 flex-col px-3 py-6 md:flex"
      style={{ background: "rgba(8, 7, 12, 0.84)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(60, 25, 120, 0.03) 0%, transparent 60%)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 top-0 w-px"
        style={{ background: "rgba(255, 255, 255, 0.05)" }}
      />

      <nav className="relative flex flex-col gap-0.5">
        {mainNavItems.map(({ id, label, icon }) => (
          <NavButton
            key={id}
            active={active === id}
            icon={icon}
            label={label}
            onClick={() => onNavigate(id)}
          />
        ))}

        <div className="mt-1">
          <button
            type="button"
            onClick={() => setKpiOpen((o) => !o)}
            className="relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13.5px] outline-none transition-all duration-150"
            style={{
              color: kpiActive ? "#e0e0e0" : "#777",
              fontWeight: kpiActive ? 500 : 400,
              background: kpiActive ? "rgba(255, 255, 255, 0.04)" : "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"
              e.currentTarget.style.color = "#aaa"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = kpiActive ? "rgba(255, 255, 255, 0.04)" : "transparent"
              e.currentTarget.style.color = kpiActive ? "#e0e0e0" : "#777"
            }}
          >
            <ChevronRight
              size={14}
              className="shrink-0 text-zinc-500 transition-transform duration-200"
              style={{ transform: kpiOpen ? "rotate(90deg)" : "rotate(0deg)" }}
              aria-hidden
            />
            <BarChart2 size={16} strokeWidth={kpiActive ? 2 : 1.5} className="ml-0.5 shrink-0" />
            <span className="font-medium">KPIs</span>
          </button>

          {kpiOpen ? (
            <div
              className="mt-0.5 space-y-0.5 border-l border-white/[0.08] pl-2 ml-4"
              role="group"
              aria-label="Submenú KPIs"
            >
              <NavButton
                active={active === "kpi"}
                icon={Table2}
                label="Reportes semanales"
                compact
                onClick={() => onNavigate("kpi")}
              />
              <NavButton
                active={active === "kpi-formularios"}
                icon={FileStack}
                label="Formularios"
                compact
                onClick={() => onNavigate("kpi-formularios")}
              />
            </div>
          ) : null}
        </div>
      </nav>

      <div className="relative mt-auto flex flex-col gap-0.5 pt-4">
        <div className="mx-3 mb-2 h-px" style={{ background: "rgba(255, 255, 255, 0.04)" }} />

        <NavButton
          active={active === "settings"}
          icon={Settings}
          label="Ajustes"
          onClick={() => onNavigate("settings")}
        />

        <button
          type="button"
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] outline-none transition-all duration-150 cursor-pointer"
          style={{ color: "#4a4a4a" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#888"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#4a4a4a"
          }}
        >
          <LogOut size={16} strokeWidth={1.5} className="ml-1 shrink-0" />
          Salir
        </button>
      </div>
    </aside>
  )
}
