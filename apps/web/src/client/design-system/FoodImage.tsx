import { useState } from 'react'
import { Icon } from './Icon'

export function FoodImage({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="food-placeholder" role="img" aria-label={`تصویر جایگزین ${alt}`}>
        <img className="food-placeholder-art" src="/illustrations/food-placeholder.svg" alt="" aria-hidden="true" />
        <span className="food-placeholder-copy">
          <strong>تصویر غذا</strong>
          <span><Icon name="freshIngredients" size="xs" /> تصویر به‌زودی اضافه می‌شود</span>
        </span>
      </div>
    )
  }

  return <img className="food-image" src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
}
