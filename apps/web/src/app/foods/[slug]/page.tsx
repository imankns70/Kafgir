import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { FoodDetailPage } from '@/client/features/foods/FoodDetailPage'
import { BrandedState } from '@/client/design-system/BrandedState'
import { getFoodCatalogDetail } from '@/server/services/food-catalog-service'

type Props = {
  params: Promise<{ slug: string }>
}

function FoodDetailFallback() {
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

async function CachedFoodDetail({ slug }: { slug: string }) {
  'use cache'

  cacheLife({ stale: 30, revalidate: 60, expire: 3600 })
  cacheTag('food-catalog', `food-catalog:${slug}`)

  const initialCatalog = await getFoodCatalogDetail(slug)

  return (
    <FoodDetailPage
      key={slug}
      slug={slug}
      initialCatalog={initialCatalog}
    />
  )
}

async function FoodDetailContent({ params }: Props) {
  const { slug } = await params
  return <CachedFoodDetail slug={slug} />
}

export default function FoodPage(props: Props) {
  return (
    <Suspense fallback={<FoodDetailFallback />}>
      <FoodDetailContent {...props} />
    </Suspense>
  )
}
