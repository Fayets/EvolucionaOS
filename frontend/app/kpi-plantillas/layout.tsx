"use client"

import { AppProvider } from "@/lib/app-context"

export default function KpiPlantillasLayout({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>
}
