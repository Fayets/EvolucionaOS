/** PRNG determinístico para estrellas fijas entre SSR y cliente */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type SpaceStar = { cx: number; cy: number; r: number; o: number; fill: string }

function buildSpaceStarfield(): SpaceStar[] {
  const rand = mulberry32(0x9e3779b9)
  const stars: SpaceStar[] = []

  for (let i = 0; i < 1520; i++) {
    const g = rand()
    stars.push({
      cx: rand() * 1000,
      cy: rand() * 1000,
      r: 0.1 + rand() * 0.32,
      o: 0.1 + rand() * 0.42,
      fill: g > 0.12 ? (g > 0.55 ? "#ffffff" : "#e4e4e8") : "#c4c4cc",
    })
  }
  for (let i = 0; i < 220; i++) {
    stars.push({
      cx: rand() * 1000,
      cy: rand() * 1000,
      r: 0.32 + rand() * 0.42,
      o: 0.26 + rand() * 0.4,
      fill: rand() > 0.25 ? "#ffffff" : "#ddd6e8",
    })
  }
  for (let i = 0; i < 42; i++) {
    stars.push({
      cx: rand() * 1000,
      cy: rand() * 1000,
      r: 0.55 + rand() * 0.55,
      o: 0.42 + rand() * 0.48,
      fill: "#ffffff",
    })
  }
  return stars
}

const SPACE_STARS = buildSpaceStarfield()

type StarfieldBackdropProps = {
  /** Clases extra en el SVG (p. ej. opacidad en dashboards oscuros) */
  className?: string
}

export function StarfieldBackdrop({ className }: StarfieldBackdropProps) {
  return (
    <svg
      className={["pointer-events-none absolute inset-0 size-full", className].filter(Boolean).join(" ")}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {SPACE_STARS.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} opacity={s.o} />
      ))}
    </svg>
  )
}

/** Nebulosa violeta/rosa (login / bienvenida cliente) */
export function SpaceVioletNebula() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background: `
          radial-gradient(ellipse 75% 90% at 96% 38%, rgba(130, 55, 155, 0.28) 0%, transparent 52%),
          radial-gradient(ellipse 55% 75% at 88% 72%, rgba(90, 35, 110, 0.16) 0%, transparent 48%),
          radial-gradient(ellipse 40% 55% at 100% 55%, rgba(180, 80, 140, 0.12) 0%, transparent 42%)
        `,
        mixBlendMode: "screen",
        opacity: 0.72,
      }}
    />
  )
}
