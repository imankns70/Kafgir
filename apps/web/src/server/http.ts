import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'
import { AppError } from './errors'
import { errorFields, logger } from './logging/logger'

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let value: unknown
  try {
    value = await request.json()
  } catch {
    throw new AppError('Request body must be valid JSON.')
  }

  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Request is invalid.')
  }
  return result.data
}

export function routeError(error: unknown) {
  if (error instanceof AppError) {
    logger.warn({ event: 'http.request.rejected', status: error.status, ...errorFields(error) }, error.message)
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  logger.error({ event: 'http.request.failed', status: 500, ...errorFields(error) }, 'خطای مدیریت‌نشده در درخواست')
  if (process.env.NODE_ENV !== 'production') {
    const message = error instanceof Error ? error.message : String(error)
    const detail = error instanceof Error ? error.stack : undefined
    return NextResponse.json({ error: message || 'خطای داخلی سرور رخ داد.', detail }, { status: 500 })
  }
  return NextResponse.json({ error: 'خطای داخلی سرور رخ داد.' }, { status: 500 })
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}
