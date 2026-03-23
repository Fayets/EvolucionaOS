"use client"

import { AppProvider, useApp } from "@/lib/app-context"
import { AppNotifications } from "@/components/app-notifications"
import { LoginForm } from "@/components/login-form"
import { ClientView } from "@/components/client/client-view"
import { DirectorView } from "@/components/director/director-view"

function DashboardAtmosphere() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Primary violet nebula — upper-left bias for organic feel */}
      <div
        className="absolute"
        style={{
          width: "1200px",
          height: "900px",
          top: "10%",
          left: "20%",
          transform: "translate(-50%, -30%)",
          background: "radial-gradient(ellipse at center, rgba(88, 40, 180, 0.10) 0%, rgba(60, 25, 130, 0.04) 45%, transparent 70%)",
          filter: "blur(140px)",
        }}
      />
      {/* Secondary nebula — lower-right for balance */}
      <div
        className="absolute"
        style={{
          width: "1000px",
          height: "800px",
          bottom: "5%",
          right: "10%",
          transform: "translate(30%, 20%)",
          background: "radial-gradient(ellipse at center, rgba(70, 30, 150, 0.07) 0%, rgba(50, 20, 110, 0.03) 40%, transparent 65%)",
          filter: "blur(150px)",
        }}
      />
      {/* Subtle top wash — depth for header zone */}
      <div
        className="absolute top-0 left-0 right-0 h-64"
        style={{
          background: "linear-gradient(180deg, rgba(60, 25, 120, 0.04) 0%, transparent 100%)",
        }}
      />
    </div>
  )
}

function AppContent() {
  const { isLoggedIn, userRole } = useApp()

  if (!isLoggedIn) {
    return <LoginForm />
  }

  return (
    <div className="relative min-h-screen" style={{ background: "#060606" }}>
      <DashboardAtmosphere />
      <div className="relative z-10">
        <AppNotifications />
        {userRole === "director" ? <DirectorView /> : <ClientView />}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
