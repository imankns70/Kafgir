import { NextResponse } from 'next/server'
import { menuCartSnapshotRequestSchema } from '@kafgir/contracts'
import { readJson, routeError } from '@/server/http'
import { getMenuCartSnapshotByDate } from '@/server/services/menu-service'
import { businessDate } from '@/server/time'

export async function POST(request: Request) {
  try {
    const { items } = await readJson(request, menuCartSnapshotRequestSchema)
    const snapshot = await getMenuCartSnapshotByDate(businessDate(), items)
    return snapshot
      ? NextResponse.json(snapshot)
      : NextResponse.json({ error: 'Menu was not found.' }, { status: 404 })
  } catch (error) {
    return routeError(error)
  }
}
