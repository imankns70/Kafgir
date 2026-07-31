import {
  pbkdf2Sync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

const scryptN = 16_384
const scryptR = 8
const scryptP = 1
const keyLength = 32

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, keyLength, {
    N: scryptN,
    r: scryptR,
    p: scryptP,
    maxmem: 64 * 1024 * 1024,
  })
  return `scrypt$${scryptN}$${scryptR}$${scryptP}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyScryptPassword(password: string, encoded: string): boolean {
  const [algorithm, n, r, p, saltValue, hashValue] = encoded.split('$')
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltValue || !hashValue) return false
  const expected = Buffer.from(hashValue, 'base64')
  const actual = scryptSync(password, Buffer.from(saltValue, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  })
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function verifyAspNetIdentityV3(password: string, encoded: string): boolean {
  try {
    const payload = Buffer.from(encoded, 'base64')
    if (payload.length < 14 || payload[0] !== 0x01) return false
    const prf = payload.readUInt32BE(1)
    const iterations = payload.readUInt32BE(5)
    const saltLength = payload.readUInt32BE(9)
    if (saltLength < 16 || payload.length <= 13 + saltLength) return false
    const salt = payload.subarray(13, 13 + saltLength)
    const expected = payload.subarray(13 + saltLength)
    const digest = prf === 0 ? 'sha1' : prf === 1 ? 'sha256' : prf === 2 ? 'sha512' : null
    if (!digest) return false
    const actual = pbkdf2Sync(password, salt, iterations, expected.length, digest)
    return timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

export function verifyPassword(password: string, hash: string, scheme: string): boolean {
  return scheme === 'scrypt'
    ? verifyScryptPassword(password, hash)
    : verifyAspNetIdentityV3(password, hash)
}
