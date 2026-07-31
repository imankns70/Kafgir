import type { DailyMenuDto } from '../types'
import { ApiError, apiGet } from './apiClient'

export async function getTodayMenu(): Promise<DailyMenuDto | null> {
  try {
    return await apiGet<DailyMenuDto>('/api/menus/today')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}
