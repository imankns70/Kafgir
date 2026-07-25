import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function BrandedState({ title, message, tone = 'neutral', icon, children }: {
  title: string
  message?: string
  tone?: 'neutral' | 'error' | 'warning'
  icon?: IconName
  children?: ReactNode
}) {
  return (
    <section className={`status-card state-${tone}`} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
      <div className="state-mark"><Icon name={icon ?? 'food'} size="xl" /></div>
      <h1 className="section-title">{title}</h1>
      {message && <p>{message}</p>}
      {children}
    </section>
  )
}
