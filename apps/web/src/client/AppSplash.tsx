'use client'

import { useEffect, useState, type CSSProperties } from 'react'

type Leaf = { x: number; y: number; angle: number; delay: number }

/** Leaves along an arc of the wreath, alternating either side of the stem as they climb. */
function arcLeaves(from: number, to: number, count: number, side: 1 | -1, delayOffset: number): Leaf[] {
  const center = 120
  const radius = 98
  return Array.from({ length: count }, (_, index) => {
    const theta = ((from + ((to - from) * index) / (count - 1)) * Math.PI) / 180
    const growth = (theta * 180) / Math.PI + 90 * side
    return {
      x: Number((center + radius * Math.cos(theta)).toFixed(2)),
      y: Number((center + radius * Math.sin(theta)).toFixed(2)),
      angle: Number((growth + (index % 2 === 0 ? 32 : -32) * side).toFixed(2)),
      delay: delayOffset + index * 70,
    }
  })
}

// Two olive branches rise from a saffron knot at the bottom and stop short of the top, leaving the
// opening the steam rises through.
const leftLeaves = arcLeaves(100, 238, 8, 1, 120)
const rightLeaves = arcLeaves(80, -58, 8, -1, 120)

function Wreath() {
  // Placement lives on the group; the leaf's own grow-in animation sets `transform` and would
  // otherwise replace it.
  const leaf = (item: Leaf, key: string) => <g key={key} transform={`translate(${item.x} ${item.y}) rotate(${item.angle})`}>
    <path className="wreath-leaf" d="M0 0c4-7 12-9 19-6-4 6-12 9-19 6Z" style={{ '--leaf-delay': `${item.delay}ms` } as CSSProperties} />
  </g>
  return <svg className="app-splash-wreath" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
    <path className="wreath-stem" d="M103.0 216.5A98 98 0 0 1 68.1 36.9" />
    <path className="wreath-stem" d="M137.0 216.5A98 98 0 0 0 171.9 36.9" />
    {leftLeaves.map((item, index) => leaf(item, `l${index}`))}
    {rightLeaves.map((item, index) => leaf(item, `r${index}`))}
    <circle className="wreath-knot" cx="120" cy="220" r="5" />
  </svg>
}

/**
 * The brand on screen from the very first paint until the app can respond.
 *
 * It is part of the server HTML, so it shows before any script loads, and it leaves as soon as React
 * has hydrated — never on a timer — so a returning customer waits for nothing extra. Everything here
 * animates in CSS from the first frame, because on a fast connection the whole splash may last well
 * under a second. The layout keeps it mounted only once: in-app navigation does not bring it back. If
 * scripts never run, the CSS fallback in `AppSplash.css` still clears it.
 */
export function AppSplash() {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>('shown')
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPhase('leaving'))
    const timer = window.setTimeout(() => setPhase('gone'), 600)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [])
  if (phase === 'gone') return null
  return <div className={`app-splash${phase === 'leaving' ? ' is-leaving' : ''}`} role="status" aria-label="در حال آماده‌سازی کفگیر">
    <span className="app-splash-dots" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
    <div className="app-splash-mark">
      <div className="app-splash-emblem">
        <Wreath />
        <span className="app-splash-steam" aria-hidden="true"><i /><i /><i /></span>
        <div className="app-splash-plate">
          <img src="/branding/logo.png" alt="" width={112} height={112} />
        </div>
      </div>
      <strong>کفگیر</strong>
      <svg className="app-splash-divider" viewBox="0 0 160 16" aria-hidden="true" focusable="false">
        <path d="M4 8h52M104 8h52" />
        <path className="divider-leaf" d="M62 8c4-6 10-7 14-4-3 5-9 6-14 4Z" />
        <path className="divider-leaf" d="M98 8c-4-6-10-7-14-4 3 5 9 6 14 4Z" />
        <circle cx="80" cy="8" r="3.2" />
      </svg>
      <span className="app-splash-slogan">غذای خونگی، با عشق</span>
    </div>
    <div className="app-splash-footer">
      <span className="app-splash-loader" aria-hidden="true"><i /><i /><i /></span>
      <span className="app-splash-hint">سفره‌ات را آماده می‌کنیم…</span>
    </div>
    <svg className="app-splash-sofreh" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 18 Q10 8 20 18 T40 18 T60 18 T80 18 T100 18 T120 18 T140 18 T160 18 T180 18 T200 18 T220 18 T240 18 T260 18 T280 18 T300 18 T320 18 T340 18 T360 18 T380 18 T400 18 V40 H0Z" />
    </svg>
  </div>
}
