import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  hashPassword,
  verifyAspNetIdentityV3,
  verifyPassword,
  verifyScryptPassword,
} from './password'

function aspNetIdentityV3Hash(password: string, prf = 2, iterations = 100_000): string {
  const salt = randomBytes(16)
  const digest = prf === 0 ? 'sha1' : prf === 1 ? 'sha256' : 'sha512'
  const derived = pbkdf2Sync(password, salt, iterations, 32, digest)
  const payload = Buffer.alloc(13 + salt.length + derived.length)
  payload[0] = 0x01
  payload.writeUInt32BE(prf, 1)
  payload.writeUInt32BE(iterations, 5)
  payload.writeUInt32BE(salt.length, 9)
  salt.copy(payload, 13)
  derived.copy(payload, 13 + salt.length)
  return payload.toString('base64')
}

describe('password compatibility', () => {
  it('creates and verifies a scrypt password', () => {
    const hash = hashPassword('secret-123')
    expect(verifyScryptPassword('secret-123', hash)).toBe(true)
  })

  it('rejects an incorrect scrypt password', () => {
    expect(verifyScryptPassword('wrong', hashPassword('correct'))).toBe(false)
  })

  it('rejects a malformed scrypt value', () => {
    expect(verifyScryptPassword('password', 'not-a-hash')).toBe(false)
  })

  it.each([0, 1, 2])('verifies ASP.NET Identity V3 PRF %i', (prf) => {
    const hash = aspNetIdentityV3Hash('legacy-password', prf)
    expect(verifyAspNetIdentityV3('legacy-password', hash)).toBe(true)
  })

  it('rejects an incorrect legacy password', () => {
    expect(verifyAspNetIdentityV3('wrong', aspNetIdentityV3Hash('correct'))).toBe(false)
  })

  it('routes verification by hash scheme', () => {
    const hash = hashPassword('selected-scheme')
    expect(verifyPassword('selected-scheme', hash, 'scrypt')).toBe(true)
  })
})
