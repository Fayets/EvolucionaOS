"use client"

import { useEffect, useRef } from "react"
const EVENTS_URL = "/events/activation-tasks"
export const ACTIVATION_TASKS_CHANGED = "activation-tasks-changed"

export function useActivationTasksSSE(userRole: string | null) {
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (userRole !== "director") return

    const connect = () => {
      const es = new EventSource(EVENTS_URL)

      es.onmessage = () => {
        window.dispatchEvent(new CustomEvent(ACTIVATION_TASKS_CHANGED))
      }

      es.onerror = () => {
        es.close()
        reconnectTimeoutRef.current = setTimeout(connect, 3000)
      }

      return es
    }

    const es = connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      es.close()
    }
  }, [userRole])
}
