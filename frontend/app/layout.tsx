import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

/**
 * Iconos generados desde `public/EvolucionaLogo.png`: `app/favicon.ico`, `icon.png`, `apple-icon.png`.
 * PWA: `manifest.ts` + `public/evoluciona-pwa-192.png` y `evoluciona-pwa-512.png`.
 * iOS cachea el icono de “Añadir a pantalla de inicio”: eliminá el acceso directo y volvé a añadirlo tras deploy.
 */
export const metadata: Metadata = {
  title: "Evoluciona",
  description: "Sistema de gestión de activación de clientes",
  appleWebApp: {
    capable: true,
    title: "Evoluciona",
    statusBarStyle: "black-translucent",
  },
}

export const viewport: Viewport = {
  themeColor: "#000000",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="min-h-full bg-black">
      <body className={`${geist.className} antialiased min-h-screen min-h-dvh bg-black text-white`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
