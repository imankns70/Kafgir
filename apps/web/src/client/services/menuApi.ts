import type { MenuCartSnapshotDto, PublicDailyMenuPageDto } from '../types'
import { ApiError, apiGet, apiPost } from './apiClient'

export type TodayMenuQuery = {
  q?: string
  category?: string
  cursor?: number | null
  limit?: number
}

export async function getTodayMenu(query: TodayMenuQuery = {}): Promise<PublicDailyMenuPageDto | null> {
  const parameters = new URLSearchParams()
  if (query.q) parameters.set('q', query.q)
  if (query.category) parameters.set('category', query.category)
  if (query.cursor) parameters.set('cursor', String(query.cursor))
  if (query.limit) parameters.set('limit', String(query.limit))
  const suffix = parameters.size > 0 ? `?${parameters.toString()}` : ''
  try {
    return await apiGet<PublicDailyMenuPageDto>(`/api/menus/today${suffix}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function getTodayMenuCartSnapshot(items: Array<{
  dailyMenuItemId: number
  foodId?: number
  foodName?: string
  withPersianRice?: boolean
}>): Promise<MenuCartSnapshotDto | null> {
  try {
    return await apiPost<MenuCartSnapshotDto>('/api/menus/today/cart-snapshot', { items })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}
