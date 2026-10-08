'use client'

import { useEffect, useState, type CSSProperties } from 'react'

type Point = readonly [number, number]
type Leaf = { x: number; y: number; angle: number; delay: number }
type Branch = { stem: string; leaves: Leaf[] }
type Curve = readonly [Point, Point, Point, Point]

/** A point and its direction along a cubic curve, used to seat leaves along a branch. */
function onCurve([p0, p1, p2, p3]: Curve, t: number) {
  const u = 1 - t
  const at = (i: 0 | 1) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]
  const slope = (i: 0 | 1) => 3 * u * u * (p1[i] - p0[i]) + 6 * u * t * (p2[i] - p1[i]) + 3 * t * t * (p3[i] - p2[i])
  return { x: at(0), y: at(1), angle: (Math.atan2(slope(1), slope(0)) * 180) / Math.PI }
}

/** One olive branch: its stem and leaves alternating either side as it grows from its first point. */
function branch(points: Curve, leafCount: number, delayOffset: number): Branch {
  const [p0, p1, p2, p3] = points
  const leaves = Array.from({ length: leafCount }, (_, index) => {
    const at = onCurve(points, 0.12 + (0.86 * index) / (leafCount - 1))
    return {
      x: Number(at.x.toFixed(1)),
      y: Number(at.y.toFixed(1)),
      angle: Number((at.angle + (index % 2 === 0 ? -38 : 38)).toFixed(1)),
      delay: delayOffset + index * 60,
    }
  })
  return { stem: `M${p0[0]} ${p0[1]}C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`, leaves }
}

// Several branches reach in from the top edge and cross one another, like a sprig laid over the
// corner of a sofreh. Computed once, identically on server and client.
const branches: Branch[] = [
  branch([[-12, 18], [70, 30], [150, 92], [236, 74]], 9, 0),
  branch([[412, 10], [330, 22], [250, 96], [158, 82]], 9, 80),
  branch([[118, -8], [140, 40], [210, 86], [300, 104]], 7, 160),
  branch([[292, -8], [262, 44], [190, 92], [96, 100]], 7, 240),
  branch([[196, -6], [190, 24], [208, 46], [226, 60]], 4, 320),
]
const saffron: Point[] = [[236, 74], [158, 82], [300, 104], [96, 100], [226, 60]]

function OliveCanopy() {
  return <svg className="app-splash-canopy" viewBox="0 0 400 130" aria-hidden="true" focusable="false">
    {branches.map((item, index) => <path key={`s${index}`} className="canopy-stem" d={item.stem} />)}
    {branches.flatMap((item, index) => item.leaves.map((leaf, leafIndex) =>
      // Placement lives on the group; the leaf's own grow-in animation sets `transform` and would
      // otherwise replace it.
      <g key={`l${index}-${leafIndex}`} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle})`}>
        <path className="canopy-leaf" d="M0 0c4-7 12-9 19-6-4 6-12 9-19 6Z" style={{ '--leaf-delay': `${leaf.delay}ms` } as CSSProperties} />
      </g>))}
    {saffron.map(([x, y], index) => <circle key={`d${index}`} className="canopy-saffron" cx={x} cy={y} r="3.4" />)}
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
    <OliveCanopy />
    <span className="app-splash-dots" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
    <div className="app-splash-mark">
      <div className="app-splash-emblem">
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
