import type {
  CustomerIdentityRequest,
  FoodDetailDto,
  FoodInteractionResponse,
} from '@kafgir/contracts'
import { apiDelete, apiPost, apiPut } from './apiClient'
import { getTelegramInitData, getTelegramUser } from './telegram'

export function customerIdentity(): CustomerIdentityRequest {
  const user = getTelegramUser()
  return {
    telegramInitData: getTelegramInitData(),
    telegramUserId: user?.id ?? null,
    telegramUsername: user?.username ?? null,
  }
}

export const getFoodDetails = (slug: string, menuItemId: number | null) =>
  apiPost<FoodDetailDto>(
    `/api/foods/${encodeURIComponent(slug)}/details${menuItemId ? `?menuItemId=${menuItemId}` : ''}`,
    customerIdentity(),
  )

export const likeFood = (slug: string, liked: boolean) =>
  (liked ? apiPut<FoodInteractionResponse> : apiDelete<FoodInteractionResponse>)(
    `/api/foods/${encodeURIComponent(slug)}/like`,
    customerIdentity(),
  )

export const favoriteFood = (slug: string, favorite: boolean) =>
  (favorite ? apiPut<FoodInteractionResponse> : apiDelete<FoodInteractionResponse>)(
    `/api/foods/${encodeURIComponent(slug)}/favorite`,
    customerIdentity(),
  )

