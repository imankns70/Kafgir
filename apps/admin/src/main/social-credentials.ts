import { safeStorage } from 'electron'
import type { SocialProviderCredential } from '@kafgir/server-core'

export function encryptSocialCredential(token: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('رمزنگاری امن ویندوز در دسترس نیست؛ توکن ذخیره نشد.')
  }
  const value: SocialProviderCredential = { token: token.trim() }
  return safeStorage.encryptString(JSON.stringify(value)).toString('base64')
}

export async function resolveSocialCredential(
  _channelId: number,
  credentialCiphertext: string,
): Promise<SocialProviderCredential> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('رمزنگاری امن ویندوز در دسترس نیست.')
  }
  try {
    const value = JSON.parse(safeStorage.decryptString(Buffer.from(credentialCiphertext, 'base64'))) as unknown
    if (!value || typeof value !== 'object' || !('token' in value) || typeof value.token !== 'string' || !value.token) {
      throw new Error('invalid')
    }
    return { token: value.token }
  } catch {
    throw new Error('توکن رمزنگاری‌شده کانال قابل خواندن نیست.')
  }
}
