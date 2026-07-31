type LogoVariant = 'horizontal' | 'compact' | 'symbol' | 'light' | 'dark' | 'primary' | 'full'

export function BrandLogo({ variant = 'compact', className = '' }: { variant?: LogoVariant; className?: string }) {
  const normalizedVariant = variant === 'full' ? 'horizontal' : variant
  const isLockup = normalizedVariant === 'horizontal' || normalizedVariant === 'compact'

  return (
    <span className={`brand-logo brand-logo-${normalizedVariant} ${className}`}>
      <img className="brand-logo-image" src="/branding/logo.png" alt="کفگیر" />
      {isLockup && <span className="brand-logo-wordmark" aria-hidden="true">کفگیر</span>}
    </span>
  )
}
