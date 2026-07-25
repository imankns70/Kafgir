type LogoVariant = 'horizontal' | 'compact' | 'symbol' | 'light' | 'dark' | 'primary' | 'full'

const symbolByVariant: Record<'default' | 'light' | 'dark', string> = {
  default: '/branding/kafgir-symbol.svg',
  light: '/branding/kafgir-symbol-light.svg',
  dark: '/branding/kafgir-symbol-dark.svg',
}

function getSymbolSource(variant: LogoVariant) {
  if (variant === 'light') return symbolByVariant.light
  if (variant === 'dark') return symbolByVariant.dark
  return symbolByVariant.default
}

export function BrandLogo({ variant = 'compact', className = '' }: { variant?: LogoVariant; className?: string }) {
  if (variant === 'symbol') {
    return (
      <span className={`brand-logo brand-logo-symbol ${className}`} role="img" aria-label="کفگیر">
        <img src="/branding/kafgir-symbol.svg" alt="" aria-hidden="true" />
      </span>
    )
  }

  const normalizedVariant = variant === 'full' ? 'horizontal' : variant
  const monochrome = variant === 'light' || variant === 'dark'

  return (
    <span className={`brand-logo brand-logo-${normalizedVariant} ${monochrome ? 'brand-logo-monochrome' : ''} ${className}`}
      role="img" aria-label="کفگیر، آشپزخانه آنلاین غذای خانگی">
      <img className="brand-logo-icon" src={getSymbolSource(variant)} alt="" aria-hidden="true" />
      <span className="brand-logo-copy">
        <span className="brand-logo-wordmark">
          <span className="brand-logo-word">کفگیر</span>
          <svg className="brand-logo-underline" viewBox="0 0 150 18" preserveAspectRatio="none" aria-hidden="true">
            <path d="M4 5c42 13 94 12 142-1" />
          </svg>
        </span>
        <span className="brand-logo-tagline">آشپزخانه آنلاین غذای خانگی</span>
      </span>
    </span>
  )
}
