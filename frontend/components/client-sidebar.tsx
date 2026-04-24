"use client"

import Image from "next/image"
import { useApp } from "@/lib/app-context"
import { LayoutDashboard, MessageSquarePlus, LogOut } from "lucide-react"

type ClientSidebarProps = {
  primaryNavLabel?: string
  secondNavLabel?: string
  activeNav?: "primary" | "secondary"
  onPrimaryNavClick?: () => void
  onSecondNavClick?: () => void
}

export function ClientSidebar({
  primaryNavLabel = "Inicio",
  secondNavLabel = "Iniciar ticket",
  activeNav = "primary",
  onPrimaryNavClick,
  onSecondNavClick,
}: ClientSidebarProps) {
  const { logout } = useApp()

  return (
    <aside
      className="hidden md:flex flex-col w-56 min-h-0 px-3 py-6 relative"
      style={{ background: "rgba(8, 7, 12, 0.84)" }}
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
        <button
          type="button"
          onClick={onPrimaryNavClick}
          className="relative flex items-center gap-3 w-full text-left text-[13.5px] font-medium rounded-lg px-3 py-2 outline-none cursor-pointer"
          style={
            activeNav === "primary"
              ? { color: "#e0e0e0", background: "rgba(255, 255, 255, 0.05)" }
              : { color: "#666", background: "transparent" }
          }
          onMouseEnter={(e) => {
            if (activeNav === "primary") return
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"
            e.currentTarget.style.color = "#aaa"
          }}
          onMouseLeave={(e) => {
            if (activeNav === "primary") return
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.color = "#666"
          }}
        >
          {activeNav === "primary" ? (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-full"
              style={{ background: "rgba(255, 255, 255, 0.3)" }}
            />
          ) : null}
          <LayoutDashboard size={16} strokeWidth={2} className="shrink-0 ml-1" />
          {primaryNavLabel}
        </button>
        <button
          type="button"
          onClick={onSecondNavClick}
          className="flex items-center gap-3 w-full text-left text-[13.5px] rounded-lg px-3 py-2 outline-none transition-all duration-150 cursor-pointer"
          style={
            activeNav === "secondary"
              ? { color: "#e0e0e0", background: "rgba(255, 255, 255, 0.05)" }
              : { color: "#666", background: "transparent" }
          }
          onMouseEnter={(e) => {
            if (activeNav === "secondary") return
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"
            e.currentTarget.style.color = "#aaa"
          }}
          onMouseLeave={(e) => {
            if (activeNav === "secondary") return
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.color = "#666"
          }}
        >
          <MessageSquarePlus size={16} strokeWidth={1.5} className="shrink-0 ml-1" />
          {secondNavLabel}
        </button>
      </nav>

      <div className="relative mt-auto pt-4">
        <div className="h-px mx-3 mb-2" style={{ background: "rgba(255, 255, 255, 0.04)" }} />
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

export function ClientLayoutLogo() {
  return (
    <div className="pt-8 pb-4 flex justify-center w-full">
      <Image
        src="/EvolucionaLogoLogin.png"
        alt="Evoluciona"
        width={110}
        height={110}
      />
    </div>
  )
}
