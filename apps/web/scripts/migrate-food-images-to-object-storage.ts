import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { sqlClient } from '../src/server/db/client'

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

const apply = process.argv.includes('--apply')
const endpoint = required('LIARA_ENDPOINT')
const bucket = required('LIARA_BUCKET_NAME')
const publicBaseUrl = required('FOOD_MEDIA_PUBLIC_BASE').replace(/\/$/u, '')
const uploadRoot = resolve(process.env.FOOD_UPLOAD_ROOT ?? resolve(process.cwd(), '../../.data/uploads'))
const client = new S3Client({
  region: 'default',
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: required('LIARA_ACCESS_KEY'),
    secretAccessKey: required('LIARA_SECRET_KEY'),
  },
})

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
  const key = `foods/${fileName}`
  const publicUrl = `${publicBaseUrl}/${key}`
  console.info(`${apply ? 'Migrating' : 'Would migrate'} ${record.imageUrl} -> ${publicUrl}`)
  if (!apply) continue
  const bytes = await readFile(resolve(uploadRoot, 'foods', fileName))
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bytes,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  await sqlClient.begin(async (tx) => {
    await tx`UPDATE foods SET image_url = ${publicUrl} WHERE image_url = ${record.imageUrl}`
    await tx`UPDATE food_images SET image_url = ${publicUrl} WHERE image_url = ${record.imageUrl}`
  })
  migrated += 1
}

console.info(apply
  ? `Migrated ${migrated} managed food images. Local files were retained for rollback.`
  : `Dry run complete. ${records.length} managed URLs found; rerun with --apply to migrate.`)
await sqlClient.end({ timeout: 5 })
