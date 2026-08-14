import type { RateLimitPolicy } from './store'

/**
 * The single place rate-limit tiers are defined.
 *
 * Routes name a tier; they never carry their own numbers. That keeps thresholds reviewable in one
 * diff and stops two endpoints in the same tier from drifting apart.
 *
 * Customer mutation routes name the specific policies below. OTP verification policies remain
 * inside the OTP service because their phone identity comes from the validated request body.
 */

const minute = 60_000
const hour = 60 * minute

export const rateLimitPolicies = {
  /** Credentials, session minting and anything that spends money on an SMS. */
  strictAuth: {
    name: 'strict-auth',
    limit: 10,
    windowMs: hour,
    message: 'درخواست‌های زیادی ثبت شده است. کمی بعد دوباره تلاش کنید.',
  },
  /** Authenticated writes: orders, addresses, profile, likes. */
  moderateWrite: {
    name: 'moderate-write',
    limit: 60,
    windowMs: hour,
  },
  /** Public reads. Protects database load, not secrets. */
  generalRead: {
    name: 'general-read',
    limit: 300,
    windowMs: minute,
  },

  /** Checkout is expensive and creates durable business records. */
  orderPerIdentity: {
    name: 'customer-order-identity',
    limit: 5,
    windowMs: minute,
    message: 'تلاش‌های ثبت سفارش زیاد است. کمی بعد دوباره تلاش کنید.',
  },
  orderPerIp: {
    name: 'customer-order-ip',
    limit: 20,
    windowMs: minute,
    message: 'تلاش‌های ثبت سفارش از این اتصال زیاد است. کمی بعد دوباره تلاش کنید.',
  },

  /** Cart reconciliation may run on every normal quantity adjustment. */
  cartSnapshotPerIdentity: {
    name: 'cart-snapshot-identity',
    limit: 120,
    windowMs: minute,
  },
  cartSnapshotPerIp: {
    name: 'cart-snapshot-ip',
    limit: 300,
    windowMs: minute,
  },

  /** Shared by profile and saved-address mutations; ordinary account editing is far below this. */
  customerAccountWritePerIdentity: {
    name: 'customer-account-write-identity',
    limit: 30,
    windowMs: 10 * minute,
  },
  customerAccountWritePerIp: {
    name: 'customer-account-write-ip',
    limit: 120,
    windowMs: 10 * minute,
  },

  /**
   * Order reviews and customer delivery confirmations. Both are ownership-checked writes a customer
   * performs a handful of times per order, so the budget only has to stop scripted churn.
   */
  orderFeedbackPerIdentity: {
    name: 'order-feedback-identity',
    limit: 30,
    windowMs: 10 * minute,
  },
  orderFeedbackPerIp: {
    name: 'order-feedback-ip',
    limit: 120,
    windowMs: 10 * minute,
  },

  /**
   * Visitor heartbeats. Unauthenticated and it writes a row, so it needs a ceiling — but a generous
   * one: the browser sends roughly one every two minutes per open tab, and a customer may have
   * several. Keyed on the trusted IP only. The visitor id in the body is caller-chosen, so limiting
   * per visitor would let a script mint itself a fresh budget for every request.
   */
  analyticsHeartbeatPerIp: {
    name: 'analytics-heartbeat-ip',
    limit: 240,
    windowMs: 10 * minute,
  },

  /** Likes and favorites are cheap but externally repeatable toggles. */
  foodInteractionPerIdentity: {
    name: 'food-interaction-identity',
    limit: 60,
    windowMs: minute,
  },
  foodInteractionPerIp: {
    name: 'food-interaction-ip',
    limit: 180,
    windowMs: minute,
  },

  /**
   * OTP verification. Unlike sending, a verify attempt leaves no durable row to count — the
   * per-challenge counter only covers guesses against a challenge that exists — so these two
   * dimensions live in the process store. That is what stops one host from spreading guesses
   * thinly across many phone numbers.
   */
  otpVerifyPerPhone: {
    name: 'otp-verify-phone',
    limit: 10,
    windowMs: 10 * minute,
    message: 'تلاش‌های زیادی برای تایید کد انجام شده است. کمی بعد دوباره تلاش کنید.',
  },
  otpVerifyPerIp: {
    name: 'otp-verify-ip',
    limit: 30,
    windowMs: 10 * minute,
    message: 'تلاش‌های زیادی برای تایید کد انجام شده است. کمی بعد دوباره تلاش کنید.',
  },
} as const satisfies Record<string, RateLimitPolicy>

/**
 * OTP send quotas.
 *
 * These are enforced against `customer_otp_challenges` rather than the process store: every send
 * spends real SMS credit, and in-memory state resets on each deploy. The table already records one
 * row per send with `created_at` and `request_ip_digest`, so the windows below are derived from
 * existing business data — no generic counter table and no migration.
 */
export const otpSendLimits = {
  /** Rolling gap since the last reserved send, not a fixed window — two sends can never be closer. */
  perPhoneCooldownSeconds: 60,
  perPhoneShort: { limit: 3, windowMinutes: 10 },
  perPhoneDay: { limit: 10, windowHours: 24 },
  perIpShort: { limit: 10, windowMinutes: 10 },
  perIpHour: { limit: 30, windowMinutes: 60 },
} as const

export type RateLimitPolicyName = keyof typeof rateLimitPolicies

export const defaultRateLimitMessage = 'درخواست‌های زیادی ارسال شده است. کمی بعد دوباره تلاش کنید.'
