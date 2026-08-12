import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'
import { sqlClient } from '../src/server/db/client'

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

const apply = process.argv.includes('--apply')
cloudinary.config({
  cloud_name: required('CLOUDINARY_CLOUD_NAME'),
  api_key: required('CLOUDINARY_API_KEY'),
  api_secret: required('CLOUDINARY_API_SECRET'),
  secure: true,
})
const uploadRoot = resolve(process.env.FOOD_UPLOAD_ROOT ?? resolve(process.cwd(), '../../.data/uploads'))

function upload(bytes: Buffer, publicId: string) {
  return new Promise<UploadApiResponse>((resolveUpload, rejectUpload) => {
    const stream = cloudinary.uploader.upload_stream({
      public_id: publicId,
      resource_type: 'image',
      format: 'webp',
      overwrite: false,
      tags: ['kafgir-food'],
    }, (error, result) => {
      if (error) rejectUpload(error)
      else if (!result?.secure_url) rejectUpload(new Error('Cloudinary did not return a secure URL.'))
      else resolveUpload(result)
    })
    stream.end(bytes)
  })
}

const managedPrefix = '/api/media/foods/'
const records = await sqlClient<Array<{ imageUrl: string }>>`
  SELECT DISTINCT image_url AS "imageUrl"
  FROM (
    SELECT image_url FROM foods WHERE image_url LIKE '/api/media/foods/%'
    UNION ALL
    SELECT image_url FROM food_images WHERE image_url LIKE '/api/media/foods/%'
  ) managed
`

let migrated = 0
for (const record of records) {
  const fileName = record.imageUrl.slice(managedPrefix.length)
  if (!/^[0-9a-f-]{36}\.webp$/iu.test(fileName)) {
    console.warn(`Skipped invalid managed URL: ${record.imageUrl}`)
    continue
  }
  const publicId = `kafgir/foods/${fileName.replace(/\.webp$/u, '')}`
  console.info(`${apply ? 'Migrating' : 'Would migrate'} ${record.imageUrl} -> ${publicId}`)
  if (!apply) continue
  const bytes = await readFile(resolve(uploadRoot, 'foods', fileName))
  const uploaded = await upload(bytes, publicId)
  await sqlClient.begin(async (tx) => {
    await tx`UPDATE foods SET image_url = ${uploaded.secure_url} WHERE image_url = ${record.imageUrl}`
    await tx`UPDATE food_images SET image_url = ${uploaded.secure_url} WHERE image_url = ${record.imageUrl}`
  })
  migrated += 1
}

console.info(apply
  ? `Migrated ${migrated} managed food images. Local files were retained for rollback.`
  : `Dry run complete. ${records.length} managed URLs found; rerun with --apply to migrate.`)
await sqlClient.end({ timeout: 5 })
