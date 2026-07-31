import { errorFields, logger } from '../logging/logger'

type ManagedImageDeleter = (imageUrl: string) => Promise<boolean | void>

let managedImageDeleter: ManagedImageDeleter | null = null

export function configureManagedImageDeleter(deleter: ManagedImageDeleter | null) {
  managedImageDeleter = deleter
}

export async function safelyDeleteManagedFoodImage(imageUrl: string | null | undefined) {
  if (!imageUrl || !managedImageDeleter) return
  try {
    await managedImageDeleter(imageUrl)
  } catch (error) {
    logger.error(
      { event: 'food.image.remove.failed', imageUrl, ...errorFields(error) },
      'حذف تصویر مدیریت‌شده ناموفق بود',
    )
  }
}
