"use client"

import { useEffect, useRef } from "react"
const EVENTS_URL = "/events/notifications"
export const CLIENT_NOTIFICATIONS_CHANGED = "client-notifications-changed"

export function useClientNotificationsSSE(userEmail: string | null) {
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userEmail) return

    const connect = () => {
      const es = new EventSource(
        `${EVENTS_URL}?email=${encodeURIComponent(userEmail)}`
      )

      es.onmessage = () => {
        window.dispatchEvent(new CustomEvent(CLIENT_NOTIFICATIONS_CHANGED))
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
  }, [userEmail])
}
