import { NextResponse } from 'next/server'
import { routeError } from '@/server/http'
import { listFoodCategories } from '@/server/services/catalog-service'

export async function GET() {
  try {
    return NextResponse.json(await listFoodCategories(false))
  } catch (error) {
    return routeError(error)
  }
}

