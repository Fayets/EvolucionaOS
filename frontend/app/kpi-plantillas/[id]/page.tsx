"use client"

import { useParams } from "next/navigation"
import { KpiTemplateEditorPage } from "@/components/director/kpi-template-editor-page"

export default function EditarPlantillaKpiPage() {
  const params = useParams()
  const raw = params?.id
  const idStr = Array.isArray(raw) ? raw[0] : raw
  const id = idStr != null ? parseInt(String(idStr), 10) : NaN

  if (!Number.isFinite(id) || id < 1) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black px-4 text-center text-zinc-400">
        <p>ID de plantilla no válido.</p>
        <a href="/?view=kpi-formularios" className="text-violet-400 underline">
          Volver a formularios
        </a>
      </div>
    )
  }

  return <KpiTemplateEditorPage mode="edit" templateId={id} />
}
