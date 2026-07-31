import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function BrandedState({ title, message, tone = 'neutral', icon, animated = false, children }: {
  title: string
  message?: string
  tone?: 'neutral' | 'error' | 'warning'
  icon?: IconName
  animated?: boolean
  children?: ReactNode
}) {
  return (
    <section
      className={`status-card state-${tone}`}
      aria-busy={animated || undefined}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <div className={`state-mark${animated ? ' state-mark-loading' : ''}`}>
        {animated && <span className="state-steam" aria-hidden="true"><i /><i /><i /></span>}
        <Icon name={icon ?? 'food'} size="xl" />
      </div>
      <h1 className="section-title">{title}</h1>
      {message && <p>{message}</p>}
      {children}
    </section>
  )
}
