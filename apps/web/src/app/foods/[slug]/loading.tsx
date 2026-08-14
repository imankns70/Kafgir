import { BrandedState } from '@/client/design-system/BrandedState'

export default function Loading() {
  return (
    <div className="app-shell">
      <BrandedState
        animated
        title="در حال آماده‌کردن جزئیات غذا…"
        message="چند لحظه صبر کنید."
      />
    </div>
  )
}
