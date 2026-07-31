import { FoodDetailPage } from '@/client/features/foods/FoodDetailPage'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ menuItemId?: string }>
}

export default async function FoodPage({ params, searchParams }: Props) {
  const { slug } = await params
  const menuItemValue = (await searchParams).menuItemId
  const menuItemId = menuItemValue && Number.isInteger(Number(menuItemValue))
    ? Number(menuItemValue)
    : null
  return <FoodDetailPage slug={slug} menuItemId={menuItemId} />
}

