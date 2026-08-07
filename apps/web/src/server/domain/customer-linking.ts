export type CustomerLinkIdentity = {
  userId: number
  telegramUserId: number | null
}

export function isConflictingVerifiedPhoneLink(
  preferred: CustomerLinkIdentity | null,
  mapped: CustomerLinkIdentity | null,
) {
  if (!preferred || !mapped || preferred.userId === mapped.userId) return false
  if (mapped.telegramUserId === null) return false
  return preferred.telegramUserId !== mapped.telegramUserId
}

export function selectVerifiedPhoneCanonicalUserId(
  preferred: CustomerLinkIdentity | null,
  mapped: CustomerLinkIdentity | null,
  candidates: CustomerLinkIdentity[],
) {
  return preferred?.userId
    ?? mapped?.userId
    ?? candidates.find((candidate) => candidate.telegramUserId === null)?.userId
    ?? null
}
