import { jwtVerify, SignJWT } from 'jose'
import type { NextResponse } from 'next/server'
import { UnauthorizedError } from '../errors'

export const customerSessionCookie = 'kafgir_customer_session'
const customerAudience = 'Kafgir.Customer'
const sessionDays = 30

function jwtSecret() {
  const value = process.env.JWT_SIGNING_KEY
  if (!value || value.length < 32) throw new Error('JWT_SIGNING_KEY must contain at least 32 characters.')
  return new TextEncoder().encode(value)
}

export interface CustomerPrincipal {
  userId: number
  method: 'telegram' | 'phone'
}

export async function createCustomerToken(principal: CustomerPrincipal) {
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60_000)
  const token = await new SignJWT({ method: principal.method })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(principal.userId))
    .setIssuer(process.env.JWT_ISSUER ?? 'Kafgir')
    .setAudience(customerAudience)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(jwtSecret())
  return { token, expiresAt }
}

function cookieValue(request: Request) {
  const prefix = `${customerSessionCookie}=`
  return request.headers.get('cookie')?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) ?? null
}

export async function optionalCustomer(request: Request): Promise<CustomerPrincipal | null> {
  const token = cookieValue(request)
  if (!token) return null
  try {
    const verified = await jwtVerify(token, jwtSecret(), {
      issuer: process.env.JWT_ISSUER ?? 'Kafgir',
      audience: customerAudience,
    })
    const userId = Number(verified.payload.sub)
    const method = verified.payload.method
    if (!Number.isInteger(userId) || (method !== 'telegram' && method !== 'phone')) return null
    return { userId, method }
  } catch {
    return null
  }
}

export async function requireCustomer(request: Request): Promise<CustomerPrincipal> {
  const principal = await optionalCustomer(request)
  if (!principal) throw new UnauthorizedError('برای مشاهده این بخش وارد حساب خود شوید.')
  return principal
}

export function setCustomerCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(customerSessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export function clearCustomerCookie(response: NextResponse) {
  response.cookies.set(customerSessionCookie, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return
  const requestOrigin = new URL(request.url).origin
  const configured = (process.env.CUSTOMER_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (origin !== requestOrigin && !configured.includes(origin)) {
    throw new UnauthorizedError('مبدأ درخواست معتبر نیست.')
  }
}
