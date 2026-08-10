import type {
  SocialPublishResultDto,
  SocialPostTargetDto,
} from '@kafgir/contracts'
import type { TransactionSql } from 'postgres'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'
import { logger } from '../logging/logger'
import { socialPublisherFor, type SocialProviderCredential as ProviderCredential } from '../social/providers'
import { aggregateSocialPostStatus } from '../social/publication-state'
import {
  getSocialChannelCredentialRecord,
  getSocialPost,
  markSuggestionPublishedForPost,
  updateSocialChannelConnection,
} from './social-service'

export type SocialCredentialResolver = (
  channelId: number,
  credentialCiphertext: string,
) => Promise<ProviderCredential>

type ClaimedTarget = {
  id: number
  postId: number
  channelId: number
  channelTitle: string
  platform: 'Telegram' | 'Bale' | 'Eitaa'
  externalChannelId: string
  credentialCiphertext: string
  text: string
  mediaUrl: string | null
  destinationUrl: string | null
  attemptNumber: number
}

async function claimTarget(targetId: number, retry: boolean): Promise<ClaimedTarget | null> {
  return sqlClient.begin(async (tx) => {
    const rows = await tx<Array<{
      id: number
      postId: number
      channelId: number
      channelTitle: string
      platform: ClaimedTarget['platform']
      externalChannelId: string
      credentialCiphertext: string | null
      text: string
      mediaUrl: string | null
      destinationUrl: string | null
      status: string
      retryCount: number
    }>>`
      SELECT spt.id, sp.id AS "postId", sc.id AS "channelId", sc.title AS "channelTitle",
             sc.platform, sc.external_channel_id AS "externalChannelId",
             sc.credential_ciphertext AS "credentialCiphertext",
             COALESCE(spt.text_override, sp.default_text) AS text,
             COALESCE(spt.media_override, sp.media_url) AS "mediaUrl",
             COALESCE(spt.destination_url_override, sp.destination_url) AS "destinationUrl",
             spt.status, spt.retry_count AS "retryCount"
      FROM social_post_targets spt
      JOIN social_posts sp ON sp.id = spt.social_post_id
      JOIN social_channels sc ON sc.id = spt.social_channel_id
      WHERE spt.id = ${targetId} FOR UPDATE OF spt SKIP LOCKED
    `
    const row = rows[0]
    if (!row) return null
    const allowed = retry ? ['Failed', 'Unknown'].includes(row.status) : row.status === 'Pending'
    if (!allowed) return null
    if (!row.credentialCiphertext) throw new AppError(`توکن کانال «${row.channelTitle}» تنظیم نشده است.`)
    if (row.retryCount >= 3) throw new AppError('حداکثر تعداد تلاش برای این مقصد انجام شده است.')
    const attemptNumber = row.retryCount + 1
    const timestamp = new Date().toISOString()
    await tx`
      UPDATE social_post_targets SET status = 'Publishing', retry_count = ${attemptNumber},
        last_error = NULL, updated_at = ${timestamp} WHERE id = ${targetId}
    `
    await tx`
      INSERT INTO social_publication_attempts
        (social_post_target_id, attempt_number, started_at, result)
      VALUES (${targetId}, ${attemptNumber}, ${timestamp}, 'Started')
    `
    await tx`UPDATE social_posts SET status = 'Publishing', updated_at = ${timestamp} WHERE id = ${row.postId}`
    return { ...row, credentialCiphertext: row.credentialCiphertext, attemptNumber }
  })
}

async function finalizePost(tx: TransactionSql, postId: number) {
  const counts = await tx<Array<{ published: number; failed: number; pending: number }>>`
    SELECT COUNT(*) FILTER (WHERE status = 'Published')::int AS published,
           COUNT(*) FILTER (WHERE status IN ('Failed', 'Unknown'))::int AS failed,
           COUNT(*) FILTER (WHERE status IN ('Pending', 'Publishing'))::int AS pending
    FROM social_post_targets WHERE social_post_id = ${postId}
  `
  const state = counts[0] ?? { published: 0, failed: 0, pending: 0 }
  const status = aggregateSocialPostStatus(state)
  const timestamp = new Date().toISOString()
  await tx`
    UPDATE social_posts SET status = ${status}, updated_at = ${timestamp},
      published_at = CASE WHEN ${state.published} > 0 THEN COALESCE(published_at, ${timestamp}) ELSE published_at END
    WHERE id = ${postId}
  `
  if (state.published > 0) await markSuggestionPublishedForPost(tx, postId)
}

async function publishClaimedTarget(target: ClaimedTarget, resolver: SocialCredentialResolver) {
  let credential: ProviderCredential
  try {
    credential = await resolver(target.channelId, target.credentialCiphertext)
  } catch {
    throw new AppError('خواندن امن توکن کانال ممکن نشد.')
  }
  const publisher = socialPublisherFor(target.platform)
  try {
    const result = await publisher.publish({
      externalChannelId: target.externalChannelId,
      text: target.text,
      mediaUrl: target.mediaUrl,
      destinationUrl: target.destinationUrl,
    }, credential)
    await sqlClient.begin(async (tx) => {
      const timestamp = new Date().toISOString()
      await tx`
        UPDATE social_post_targets SET status = 'Published', external_message_id = ${result.externalMessageId},
          published_at = ${timestamp}, last_error = NULL, updated_at = ${timestamp}
        WHERE id = ${target.id} AND status = 'Publishing'
      `
      await tx`
        UPDATE social_publication_attempts SET result = 'Succeeded', completed_at = ${timestamp}
        WHERE social_post_target_id = ${target.id} AND attempt_number = ${target.attemptNumber}
      `
      await tx`
        UPDATE social_channels SET connection_status = 'Connected',
          last_successful_publication_at = ${timestamp}, last_publication_error = NULL,
          updated_at = ${timestamp} WHERE id = ${target.channelId}
      `
      await finalizePost(tx, target.postId)
    })
    logger.info({
      event: 'social.publish.succeeded', postId: target.postId, targetId: target.id,
      channelId: target.channelId, platform: target.platform,
    }, 'انتشار اجتماعی موفق بود')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.slice(0, 2000) : 'خطای نامشخص ارائه‌دهنده'
    await sqlClient.begin(async (tx) => {
      const timestamp = new Date().toISOString()
      await tx`
        UPDATE social_post_targets SET status = 'Failed', last_error = ${errorMessage},
          updated_at = ${timestamp} WHERE id = ${target.id} AND status = 'Publishing'
      `
      await tx`
        UPDATE social_publication_attempts SET result = 'Failed', error_message = ${errorMessage},
          completed_at = ${timestamp}
        WHERE social_post_target_id = ${target.id} AND attempt_number = ${target.attemptNumber}
      `
      await tx`
        UPDATE social_channels SET connection_status = 'Failed', last_publication_error = ${errorMessage},
          updated_at = ${timestamp} WHERE id = ${target.channelId}
      `
      await finalizePost(tx, target.postId)
    })
    logger.error({
      event: 'social.publish.failed', postId: target.postId, targetId: target.id,
      channelId: target.channelId, platform: target.platform, errorMessage,
    }, 'انتشار اجتماعی ناموفق بود')
  }
}

export async function publishSocialPost(postId: number, resolver: SocialCredentialResolver): Promise<SocialPublishResultDto> {
  const post = await getSocialPost(postId)
  const claims = await Promise.all(post.targets.map((target) => claimTarget(target.id, false)))
  const claimed = claims.filter((target): target is ClaimedTarget => target !== null)
  if (claimed.length === 0 && post.targets.every((target) => target.status !== 'Published')) {
    throw new AppError('هیچ مقصد آماده‌ای برای انتشار وجود ندارد.')
  }
  await Promise.all(claimed.map((target) => publishClaimedTarget(target, resolver)))
  const updated = await getSocialPost(postId)
  return { postId, targets: updated.targets }
}

export async function retrySocialTarget(targetId: number, resolver: SocialCredentialResolver): Promise<SocialPostTargetDto> {
  const claimed = await claimTarget(targetId, true)
  if (!claimed) throw new AppError('این مقصد در وضعیت قابل تلاش مجدد نیست.')
  await publishClaimedTarget(claimed, resolver)
  const post = await getSocialPost(claimed.postId)
  return post.targets.find((target) => target.id === targetId)!
}

export async function testSocialChannelConnection(channelId: number, resolver: SocialCredentialResolver) {
  const channel = await getSocialChannelCredentialRecord(channelId)
  if (!channel.credentialCiphertext) throw new AppError('توکن کانال تنظیم نشده است.')
  const credential = await resolver(channel.id, channel.credentialCiphertext)
  const result = await socialPublisherFor(channel.platform).testConnection(credential)
  if (result.supported) await updateSocialChannelConnection(channel.id, result.connected, result.detail)
  return result
}

export async function recoverInterruptedSocialPublications() {
  const rows = await sqlClient<Array<{ id: number; postId: number; attemptNumber: number }>>`
    UPDATE social_post_targets SET status = 'Unknown',
      last_error = 'برنامه هنگام ارسال بسته شد؛ پیش از تلاش مجدد، کانال را بررسی کنید.',
      updated_at = now()
    WHERE status = 'Publishing' AND updated_at < now() - interval '15 minutes'
    RETURNING id, social_post_id AS "postId", retry_count AS "attemptNumber"
  `
  for (const row of rows) {
    await sqlClient`
      UPDATE social_publication_attempts SET result = 'Unknown', completed_at = now(),
        error_message = 'نتیجه ارسال پس از توقف برنامه نامشخص است.'
      WHERE social_post_target_id = ${row.id} AND attempt_number = ${row.attemptNumber} AND result = 'Started'
    `
    await sqlClient.begin((tx) => finalizePost(tx, row.postId))
  }
  return rows.length
}

// Re-exporting the provider credential shape keeps callers independent from provider modules.
export type { ProviderCredential as SocialProviderCredential }
