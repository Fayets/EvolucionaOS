import { apiFetch } from "@/lib/api"

export async function requestPhaseAdvance(
  email: string,
  nextPhase: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await apiFetch("/users/phase-advance-request", {
      method: "POST",
      body: JSON.stringify({ email, next_phase: nextPhase }),
    })
    const data = (await res.json()) as { message?: string; success?: boolean }
    const message =
      typeof data.message === "string" ? data.message : "Error al enviar la solicitud"
    if (!res.ok) return { ok: false, message }
    return { ok: data.success === true, message }
  } catch {
    return { ok: false, message: "No se pudo conectar con el servidor." }
  }
}

export async function fetchMyClientPhase(): Promise<string | null> {
  try {
    const res = await apiFetch("/users/me/client-phase")
    if (!res.ok) return null
    const data = (await res.json()) as { phase?: string }
    return typeof data.phase === "string" ? data.phase : null
  } catch {
    return null
  }
}

export async function fetchPendingPhaseAdvance(
  email: string
): Promise<{ pending: boolean; targetPhase: string | null }> {
  try {
    const res = await apiFetch(
      `/users/phase-advance-status?email=${encodeURIComponent(email)}`
    )
    if (!res.ok) return { pending: false, targetPhase: null }
    const data = (await res.json()) as {
      pending?: boolean
      target_phase?: string | null
    }
    return {
      pending: data.pending === true,
      targetPhase: typeof data.target_phase === "string" ? data.target_phase : null,
    }
  } catch {
    return { pending: false, targetPhase: null }
  }
}
