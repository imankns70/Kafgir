import { NextResponse } from 'next/server'
import { routeError } from '@/server/http'
import { readFoodImage } from '@/server/storage/food-images'

export const runtime = 'nodejs'

type Context = { params: Promise<{ filename: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const fileName = (await context.params).filename
    const image = await readFoodImage(fileName)
    return new NextResponse(new Uint8Array(image), {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(image.byteLength),
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return routeError(error)
  }
}

