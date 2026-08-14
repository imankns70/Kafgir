import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth/jwt'
import { AppError } from '@/server/errors'
import { readJson, routeError } from '@/server/http'
import { deleteManagedFoodImage, storeFoodImage } from '@/server/storage/food-images'

const deleteImageSchema = z.object({
  imageUrl: z.string().trim().min(1),
})

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const form = await request.formData()
    const image = form.get('image')
    if (!(image instanceof File)) throw new AppError('یک فایل تصویر انتخاب کنید.')
    const stored = await storeFoodImage(image)
    return NextResponse.json({ imageUrl: stored.imageUrl }, { status: 201 })
  } catch (error) {
    return routeError(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request)
    const { imageUrl } = await readJson(request, deleteImageSchema)
    const removed = await deleteManagedFoodImage(imageUrl)
    if (!removed) throw new AppError('این تصویر توسط فضای ذخیره‌سازی کفگیر مدیریت نمی‌شود.')
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return routeError(error)
  }
}

