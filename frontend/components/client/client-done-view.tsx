"use client"

import { ClientLayoutLogo, ClientSidebar } from "@/components/client-sidebar"
import { Card, CardContent } from "@/components/ui/card"

export function ClientDoneView() {
  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col items-center">
      <ClientLayoutLogo />

      <div className="flex w-full flex-1">
        <ClientSidebar />

        <div className="flex-1 flex flex-col items-center justify-start px-4 pt-10 pb-10">
          <div className="relative w-full max-w-xl">
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/60 via-fuchsia-500/60 to-purple-500/60 blur-2xl opacity-60" />

            <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
              <CardContent className="pt-8 pb-8 px-8 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold mb-2">
                  Todo listo
                </h2>
                <p className="text-sm text-zinc-300">
                  Completaste el onboarding. Tu equipo tiene toda la información para armar tu roadmap. Te contactaremos en breve.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
