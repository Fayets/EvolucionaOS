"use client"

import { useState, useEffect, useCallback } from "react"
import { useApp } from "@/lib/app-context"
import { apiFetch } from "@/lib/api"
import { ClientLayoutLogo, ClientSidebar } from "@/components/client-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ONBOARDING_INTRO,
  getOnboardingPages,
  type OnboardingQuestionKey,
} from "./onboarding-questions"
import { getNextPhase } from "@/lib/phases"
const PAGES = getOnboardingPages()
const TOTAL_PAGES = 1 + PAGES.length // intro + 7 bloques

export function OnboardingForm() {
  const { userEmail, setClientPhase } = useApp()
  const [page, setPage] = useState(0)
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const fetchExisting = useCallback(async () => {
    if (!userEmail) return
    try {
      const res = await apiFetch(
        `/users/onboarding?email=${encodeURIComponent(userEmail)}`
      )
      if (res.ok) {
        const data = await res.json()
        setResponses(data.responses || {})
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [userEmail])

  useEffect(() => {
    fetchExisting()
  }, [fetchExisting])

  const setAnswer = (key: OnboardingQuestionKey, value: string) => {
    setResponses((prev) => ({ ...prev, [key]: value }))
  }

  const handleNext = () => {
    if (page < TOTAL_PAGES - 1) setPage((p) => p + 1)
  }

  const handlePrev = () => {
    if (page > 0) setPage((p) => p - 1)
  }

  const handleSubmit = async () => {
    if (!userEmail) return
    setSubmitting(true)
    const nextPhase = getNextPhase("Onboarding") ?? "done"
    try {
      const res = await apiFetch("/users/onboarding", {
        method: "PUT",
        body: JSON.stringify({ email: userEmail, responses }),
      })
      if (!res.ok) throw new Error()
      await apiFetch("/users/client-phase", {
        method: "PUT",
        body: JSON.stringify({ email: userEmail, phase: nextPhase }),
      })
      setClientPhase(nextPhase)
    } catch {
      setSubmitting(false)
    }
  }

  const isIntro = page === 0
  const isLastPage = page === TOTAL_PAGES - 1
  const questionsInPage = !isIntro ? PAGES[page - 1] : []

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent text-white flex flex-col items-center">
        <ClientLayoutLogo />
        <div className="flex w-full flex-1">
          <ClientSidebar />
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-zinc-500">Cargando formulario...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col items-center">
      <ClientLayoutLogo />

      <div className="flex w-full flex-1">
        <ClientSidebar />

        <div className="flex-1 flex flex-col items-center justify-start px-4 pt-10 pb-10">
          <div className="relative w-full max-w-2xl">
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500/60 via-fuchsia-500/60 to-purple-500/60 blur-2xl opacity-60" />

            <Card className="relative w-full border border-zinc-800 bg-black/80 text-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
              <CardHeader className="pb-3 border-b border-zinc-800 px-6 md:px-10 flex flex-row items-center justify-between gap-4">
                <p className="inline-flex max-w-fit rounded bg-zinc-100 px-3 py-1 text-sm font-semibold text-black">
                  FORMULARIO DE ONBOARDING
                </p>
                <span className="text-xs text-zinc-500">
                  {page + 1} / {TOTAL_PAGES}
                </span>
              </CardHeader>

              <CardContent className="px-6 md:px-10 py-7">
                {isIntro ? (
                  <div className="space-y-4 text-sm text-zinc-300">
                    <p className="font-medium text-white">{ONBOARDING_INTRO.title}</p>
                    {ONBOARDING_INTRO.paragraphs.map((para, i) => (
                      <p key={i} className="whitespace-pre-line">
                        {para}
                      </p>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {questionsInPage.map((q) => (
                      <div key={q.key} className="space-y-2">
                        <Label
                          htmlFor={q.key}
                          className="text-sm font-medium text-white"
                        >
                          {q.label}
                        </Label>
                        <Textarea
                          id={q.key}
                          value={responses[q.key] ?? ""}
                          onChange={(e) => setAnswer(q.key, e.target.value)}
                          placeholder={q.example}
                          className="min-h-[80px] resize-y bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
                          rows={3}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                    onClick={handlePrev}
                    disabled={page === 0}
                  >
                    Anterior
                  </Button>
                  {!isLastPage ? (
                    <Button
                      type="button"
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-6"
                      onClick={handleNext}
                    >
                      Siguiente
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-6"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? "Guardando…" : "Enviar formulario"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
