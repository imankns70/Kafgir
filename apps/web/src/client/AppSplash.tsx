'use client'

import { useEffect, useState } from 'react'

/** A sprig drawn in the brand's olive: a stem and a few leaves, restrained rather than ornamental. */
function OliveSprig({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 120 60" aria-hidden="true" focusable="false">
    <path className="sprig-stem" d="M4 52C30 46 62 34 116 8" />
    <path className="sprig-leaf" d="M28 46c-2-10 4-18 14-20-1 10-6 17-14 20Z" />
    <path className="sprig-leaf" d="M30 47c9 4 18 2 24-6-9-4-18-2-24 6Z" />
    <path className="sprig-leaf" d="M60 32c-1-11 6-19 16-20-1 10-7 18-16 20Z" />
    <path className="sprig-leaf" d="M62 33c9 4 19 1 25-7-10-4-19-1-25 7Z" />
    <path className="sprig-leaf" d="M92 18c0-9 6-15 14-16-1 8-6 14-14 16Z" />
    <circle className="sprig-saffron" cx="110" cy="10" r="3" />
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
    <OliveSprig className="app-splash-sprig app-splash-sprig-top" />
    <OliveSprig className="app-splash-sprig app-splash-sprig-bottom" />
    <div className="app-splash-mark">
      <div className="app-splash-plate">
        <span className="app-splash-steam" aria-hidden="true"><i /><i /><i /></span>
        <img src="/branding/logo.png" alt="" width={116} height={116} />
      </div>
      <strong>کفگیر</strong>
      <svg className="app-splash-divider" viewBox="0 0 160 16" aria-hidden="true" focusable="false">
        <path d="M4 8h52M104 8h52" />
        <path className="divider-leaf" d="M62 8c4-6 10-7 14-4-3 5-9 6-14 4Z" />
        <path className="divider-leaf" d="M98 8c-4-6-10-7-14-4 3 5 9 6 14 4Z" />
        <circle cx="80" cy="8" r="3.2" />
      </svg>
      <span className="app-splash-slogan">غذای خونگی، با عشق</span>
      <span className="app-splash-hint">سفره‌ات را آماده می‌کنیم…</span>
    </div>
  </div>
}
