"use client"

import { useApp } from "@/lib/app-context"
import {
  LayoutDashboard,
  LayoutGrid,
  Users,
  Settings,
  LogOut,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type DirectorViewId =
  | "tasks"
  | "users"
  | "phases"
  | "settings"

type DirectorSidebarProps = {
  active: DirectorViewId
  onNavigate: (view: DirectorViewId) => void
}

const navItems: { id: DirectorViewId; label: string; icon: LucideIcon }[] = [
  { id: "tasks", label: "Inicio", icon: LayoutDashboard },
  { id: "users", label: "Usuarios", icon: Users },
  { id: "phases", label: "Fases", icon: LayoutGrid },
]

function NavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center gap-3 w-full text-left text-[13.5px] rounded-lg px-3 py-2 outline-none transition-all duration-150 cursor-pointer"
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
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-full"
          style={{ background: "rgba(255, 255, 255, 0.3)" }}
        />
      )}
      <Icon size={16} strokeWidth={active ? 2 : 1.5} className="shrink-0 ml-1" />
      {label}
    </button>
  )
}

export function DirectorSidebar({ active, onNavigate }: DirectorSidebarProps) {
  const { logout } = useApp()

  return (
    <aside
      className="hidden md:flex flex-col w-56 min-h-0 px-3 py-6 relative"
      style={{ background: "rgba(8, 7, 12, 0.7)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(60, 25, 120, 0.03) 0%, transparent 60%)" }}
      />
      <div
        className="pointer-events-none absolute top-0 right-0 bottom-0 w-px"
        style={{ background: "rgba(255, 255, 255, 0.05)" }}
      />

      <nav className="relative flex flex-col gap-0.5">
        {navItems.map(({ id, label, icon }) => (
          <NavButton
            key={id}
            active={active === id}
            icon={icon}
            label={label}
            onClick={() => onNavigate(id)}
          />
        ))}
      </nav>

      <div className="relative mt-auto pt-4 flex flex-col gap-0.5">
        <div className="h-px mx-3 mb-2" style={{ background: "rgba(255, 255, 255, 0.04)" }} />

        <NavButton
          active={active === "settings"}
          icon={Settings}
          label="Ajustes"
          onClick={() => onNavigate("settings")}
        />

        <button
          type="button"
          onClick={() => logout()}
          className="flex items-center gap-3 w-full text-left text-[13.5px] rounded-lg px-3 py-2 outline-none transition-all duration-150 cursor-pointer"
          style={{ color: "#4a4a4a" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#888" }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#4a4a4a" }}
        >
          <LogOut size={16} strokeWidth={1.5} className="shrink-0 ml-1" />
          Salir
        </button>
      </div>
    </aside>
  )
}
