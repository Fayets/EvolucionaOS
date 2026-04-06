/** Destino del backend: usado por `app/api/[[...path]]/route.ts` (proxy servidor). SSE sigue por rewrite. */
const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000"

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    return [
      // /api lo atiende el Route Handler (evita 307/308 al navegador con Location a otro host → pierde Authorization).
      { source: "/events/:path*", destination: `${backendUrl}/events/:path*` },
    ]
  },
}

export default nextConfig
