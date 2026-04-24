"use client"

import { Button } from "@/components/ui/button"
import { useApp } from "@/lib/app-context"

type AppHeaderProps = {
  variant?: "default" | "dark"
}

export function AppHeader({ variant = "default" }: AppHeaderProps) {
  const { userRole, logout, userEmail } = useApp()

  const isDark = variant === "dark"

  return (
    <header
      className={
        isDark
          ? "sticky top-0 z-10 border-b border-zinc-800 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/80"
          : "sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border"
      }
    >
      <div className="max-w-4xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={
              isDark ? "font-semibold text-white" : "font-semibold text-foreground"
            }
          >
            Evoluciona
          </span>
          {userRole && (
            <span
              className={
                isDark
                  ? "text-xs text-zinc-400 bg-zinc-900 border border-zinc-700 px-2 py-1 rounded-full"
                  : "text-xs text-muted-foreground bg-muted px-2 py-1 rounded"
              }
            >
              {userRole === "director" ? "Director de Sistemas" : "Cliente"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span
            className={
              isDark
                ? "text-sm text-zinc-400 hidden sm:block"
                : "text-sm text-muted-foreground hidden sm:block"
            }
          >
            {userEmail}
          </span>
          <Button
            variant={isDark ? "ghost" : "ghost"}
            size="sm"
            onClick={logout}
            className={
              isDark
                ? "text-zinc-300 hover:text-white hover:bg-zinc-900"
                : undefined
            }
          >
            Salir
          </Button>
        </div>
      </div>
    </header>
  )
}
