import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../design-system/Icon'

const fallbackHeroImage = '/kafgir-food-hero.jpg'
const slideInterval = 5500

type Props = {
  images: Array<string | null | undefined>
}

export function HeroCarousel({ images }: Props) {
  const slides = useMemo(() => {
    const menuImages = images.filter((image): image is string => Boolean(image))
    return [...new Set([fallbackHeroImage, ...menuImages])]
  }, [images])
  const [activeSlide, setActiveSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (activeSlide < slides.length) return
    setActiveSlide(0)
  }, [activeSlide, slides.length])

  useEffect(() => {
    if (slides.length < 2 || isPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length)
    }, slideInterval)

    return () => window.clearInterval(timer)
  }, [isPaused, slides.length])

  const showPrevious = () => {
    setActiveSlide((current) => (current - 1 + slides.length) % slides.length)
  }

  const showNext = () => {
    setActiveSlide((current) => (current + 1) % slides.length)
  }

  return (
    <div
      className="hero-carousel"
      role="region"
      aria-roledescription="اسلایدشو"
      aria-label="تصاویر غذاهای امروز"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false)
      }}
    >
      <div className="hero-carousel-slides" aria-live="off">
        {slides.map((image, index) => (
          <img
            key={image}
            className={index === activeSlide ? 'hero-carousel-image active' : 'hero-carousel-image'}
            src={image}
            alt=""
            aria-hidden={index !== activeSlide}
            loading={index === 0 ? 'eager' : 'lazy'}
            onError={(event) => {
              if (!event.currentTarget.src.endsWith(fallbackHeroImage)) {
                event.currentTarget.src = fallbackHeroImage
              }
            }}
          />
        ))}
      </div>
      <div className="hero-carousel-shade" aria-hidden="true" />

      {slides.length > 1 && (
        <div className="hero-carousel-controls">
          <button type="button" className="hero-carousel-arrow" onClick={showPrevious} aria-label="تصویر قبلی">
            <Icon name="back" size="sm" />
          </button>
          <div className="hero-carousel-dots" role="group" aria-label="انتخاب تصویر">
            {slides.map((image, index) => (
              <button
                key={image}
                type="button"
                className={index === activeSlide ? 'hero-carousel-dot active' : 'hero-carousel-dot'}
                onClick={() => setActiveSlide(index)}
                aria-label={`تصویر ${index + 1} از ${slides.length}`}
                aria-current={index === activeSlide ? 'true' : undefined}
              />
            ))}
          </div>
          <button type="button" className="hero-carousel-arrow" onClick={showNext} aria-label="تصویر بعدی">
            <Icon name="forward" size="sm" />
          </button>
        </div>
      )}
    </div>
  )
}
