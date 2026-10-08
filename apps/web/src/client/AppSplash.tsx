'use client'

import { useEffect, useState } from 'react'

/**
 * The brand on screen from the very first paint until the app can respond.
 *
 * It is part of the server HTML, so it shows before any script loads, and it leaves as soon as React
 * has hydrated — never on a timer — so a returning customer waits for nothing extra. The layout keeps
 * it mounted only once: in-app navigation does not bring it back. If scripts never run, the CSS
 * fallback in `AppSplash.css` still clears it.
 */
export function AppSplash() {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>('shown')
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPhase('leaving'))
    const timer = window.setTimeout(() => setPhase('gone'), 450)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [])
  if (phase === 'gone') return null
  return <div className={`app-splash${phase === 'leaving' ? ' is-leaving' : ''}`} role="status" aria-label="در حال آماده‌سازی کفگیر">
    <div className="app-splash-mark">
      <img src="/branding/logo.png" alt="" width={112} height={112} />
      <strong>کفگیر</strong>
      <span>غذای خونگی، با عشق</span>
    </div>
  </div>
}
