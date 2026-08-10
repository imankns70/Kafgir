# Rate limiting

## V1 architecture

Kafgir rate limiting has two intentionally different storage paths:

- Generic customer mutation and OTP-verify dimensions use the bounded, expiring
  `InMemoryRateLimitStore` through `IRateLimitStore`.
- OTP-send quotas use the existing PostgreSQL `customer_otp_challenges` records and transactional
  advisory locks because every accepted send consumes SMS credit and must survive a process restart.

Generic keys are HMAC-derived before reaching the store. Raw IP addresses, phone numbers, customer
IDs, Telegram IDs, VisitorIds, tokens and request bodies are never stored as limiter keys or emitted
in rejection events.

## Actual endpoint classification

Classification describes the current implementation. `General` means deliberately unrestricted by
the generic limiter in V1; it does not imply that a hidden general policy is attached.

### Strict

| Endpoint | Enforcement |
|---|---|
| `POST /api/auth/customer/otp/request` | Durable phone cooldown/10-minute/day quotas plus trusted-IP 10-minute/hour quotas |
| `POST /api/auth/customer/otp/verify` | Per-challenge five-attempt cap plus in-memory phone and trusted-IP quotas |

### Moderate

| Endpoint group | Identity / window | Trusted-IP safety / window |
|---|---:|---:|
| `POST /api/orders` | 5/minute | 20/minute |
| `POST /api/menus/today/cart-snapshot` | 120/minute | 300/minute |
| `PATCH /api/customers/me` | 30/10 minutes, shared account bucket | 120/10 minutes |
| `POST /api/customers/me/addresses` | 30/10 minutes, shared account bucket | 120/10 minutes |
| `PUT/DELETE /api/customers/me/addresses/[id]` | 30/10 minutes, shared account bucket | 120/10 minutes |
| `PUT/DELETE /api/foods/[slug]/like` | 60/minute, shared interaction bucket | 180/minute |
| `PUT/DELETE /api/foods/[slug]/favorite` | 60/minute, shared interaction bucket | 180/minute |

Order identity is the authenticated customer or validated Telegram user. Cart identity prefers the
authenticated customer, then the first-party VisitorId, then trusted IP as an anonymous fallback.
Account and food-interaction routes use the authenticated/resolved internal customer identity.

### General — currently unrestricted reads

- `GET /api/menus/today`
- `GET /api/delivery-slots`
- `GET /api/food-categories`
- `GET /api/media/foods/[filename]`
- `GET/POST /api/foods/[slug]/details` (`POST` is an identity-aware read)
- `POST /api/favorites` (identity-aware read)
- `GET /api/auth/customer/session`
- `GET /api/customers/me`
- `POST /api/customers/me` (legacy signed-Telegram profile lookup)
- `GET /api/customers/me/addresses`
- `GET /api/customers/me/orders`
- `GET /api/customers/me/orders/[id]`
- `GET /api/customers/me/orders/[id]/review`

No general-read limiter is attached merely to complete this classification.

### None

- `GET /api/health` — must remain available for platform health checking.
- `POST /api/auth/admin/login` and every authenticated `/api/admin/*` route — Admin limiting is
  explicitly outside V1 scope.
- Electron typed IPC operations — not HTTP endpoints and explicitly outside this limiter.
- `POST /api/auth/customer/telegram` — validated signed Telegram login, not included in approved V1
  rate-limit scope.
- `POST /api/auth/customer/logout` — same-origin cookie clearing.
- `POST /api/analytics/heartbeat` — same-origin and independently write-throttled by its analytics
  service, not by the generic rate limiter.
- `POST/PUT /api/customers/me/orders/[id]/review` — authenticated, ownership-checked and same-origin,
  but not included in the previously approved Phase 4 mutation set.

### External callback / processor

- `POST /api/internal/notifications/process` — secret-protected notification processor invoked by an
  external scheduler. It has no customer rate-limit policy.

No other external callback or webhook route currently exists.

## Rejection observability

Every rejection emits one structured warning with event `rate_limit.rejected`. Allowed requests are
not logged. The payload is constructed from an allowlist containing only:

- `policy`
- `operation`
- `retryAfterSeconds`
- `storeDistributed`
- HTTP status `429`

The event never contains raw identity values, credentials, request bodies or rate-limit thresholds.
The HTTP response retains the existing `{ error }` shape and `Retry-After`; it exposes no remaining
count or limit headers.

## Operational limitations

- Generic limiting uses fixed windows.
- The generic store is in memory, per process and non-distributed.
- Generic counters reset on deploy or process restart.
- The current design is suitable only while the web application runs as one instance.
- A fixed-window boundary may permit up to roughly twice a threshold across adjacent windows.
- `TRUSTED_PROXY_HOPS` must be explicitly configured and verified against the deployed proxy chain.
- The shared same-origin helper permits requests with no `Origin`; this remains a separate security
  consideration and was not changed by the rate-limiting work.

## Future shared-store migration

Before running more than one web replica, implement a Redis-backed `IRateLimitStore` with an atomic
`consume`, bounded expiry and `isDistributed = true`, then install it through the existing store
boundary. Route policies, HMAC key derivation, error handling and endpoint wiring should not change.
OTP-send quotas remain PostgreSQL-backed unless a separately reviewed design replaces their durable
reservation semantics. No Redis dependency or implementation is included in V1.
