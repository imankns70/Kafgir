import { Suspense } from 'react'
import { FoodDetailPage } from '@/client/features/foods/FoodDetailPage'
import { BrandedState } from '@/client/design-system/BrandedState'
import { getFoodDetail } from '@/server/services/food-discovery-service'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ menuItemId?: string }>
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

async function FoodDetailContent({ params, searchParams }: Props) {
  const { slug } = await params
  const menuItemValue = (await searchParams).menuItemId
  const menuItemId = menuItemValue && Number.isInteger(Number(menuItemValue))
    ? Number(menuItemValue)
    : null
  const initialFood = await getFoodDetail(slug, menuItemId, null)

  return (
    <FoodDetailPage
      key={`${slug}:${menuItemId ?? 'none'}`}
      slug={slug}
      menuItemId={menuItemId}
      initialFood={initialFood}
    />
  )
}

export default function FoodPage(props: Props) {
  return (
    <Suspense fallback={<FoodDetailFallback />}>
      <FoodDetailContent {...props} />
    </Suspense>
  )
}
