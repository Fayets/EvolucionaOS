import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

/** Mismo default que next.config (sin barra final). */
const BACKEND = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
)

const SKIP_RES_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-encoding",
])

function buildUpstreamUrl(req: NextRequest, segments: string[] | undefined) {
  const sub = segments?.length ? segments.join("/") : ""
  return `${BACKEND}/api/${sub}${req.nextUrl.search}`
}

function forwardHeaders(req: NextRequest): Headers {
  const h = new Headers()
  for (const name of [
    "authorization",
    "content-type",
    "accept",
    "accept-language",
  ] as const) {
    const v = req.headers.get(name)
    if (v) h.set(name, v)
  }
  return h
}

async function proxy(req: NextRequest, segments: string[] | undefined) {
  const url = buildUpstreamUrl(req, segments)
  const method = req.method

  const init: RequestInit & { duplex?: string } = {
    method,
    headers: forwardHeaders(req),
    redirect: "follow",
    cache: "no-store",
  }

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    init.body = req.body
    init.duplex = "half"
  }

  let upstream: Response
  try {
    upstream = await fetch(url, init)
  } catch {
    return NextResponse.json(
      { detail: "No se pudo contactar al backend" },
      { status: 502 }
    )
  }

  const out = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
  })

  upstream.headers.forEach((value, key) => {
    const lk = key.toLowerCase()
    if (SKIP_RES_HEADERS.has(lk)) return
    out.headers.set(key, value)
  })

  return out
}

type RouteCtx = { params: Promise<{ path?: string[] }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function OPTIONS(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params
  return proxy(req, path)
}
