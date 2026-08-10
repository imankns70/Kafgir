# Lightweight customer analytics

Kafgir V1 analytics measures customer-facing Web/Mini App activity only. Electron Admin activity is
never recorded. The feature is first-party, does not fingerprint devices, does not derive identity
from IP addresses, and does not create a `users` row for an anonymous visitor.

## Identity and sessions

- The browser creates a cryptographically random UUID and keeps it in first-party local storage.
- The server mirrors the validated visitor and session UUIDs into HttpOnly, SameSite=Lax cookies so
  order attribution cannot be supplied as an arbitrary request-body field.
- A session starts on first activity or after more than 30 minutes without activity. Exactly 30
  minutes remains the current session.
- A heartbeat is sent immediately, every two minutes while the document is visible, and when the
  document becomes visible again. The server writes `last_seen_at` at most once per 60 seconds.
- Successful Telegram or mobile authentication associates the current session with the customer
  user without replacing the anonymous visitor UUID.
- Analytics errors are logged and swallowed in authentication flows. Order attribution is nullable;
  menu, login, cart, checkout, order creation and payment do not depend on analytics availability.

## Today's dashboard metrics

All day-based metrics use the centralized Tehran business date and PostgreSQL boundaries built with
`AT TIME ZONE 'Asia/Tehran'`.

1. `بازدیدکنندگان یکتای امروز`: distinct visitor UUIDs with activity today.
2. `آنلاین الان`: distinct visitors active in the inclusive previous five minutes.
3. `مهمان‌های امروز`: today's visitors with no authenticated activity today.
4. `کاربران واردشده امروز`: distinct authenticated user IDs active today.
5. `کاربران جدید`: authenticated active users whose account was created today.
6. `کاربران بازگشتی`: authenticated active users whose account predates today.
7. `نشست‌های امروز`: sessions whose `started_at` belongs to today.
8. `نرخ تبدیل به سفارش`: distinct attributed visitors with at least one order today divided by
   today's distinct visitors. Multiple orders by one visitor count once; zero visitors returns 0%.

Electron requests all eight values through one typed `dashboard.analytics` IPC operation. The
dashboard polls every 30 seconds only while visible, prevents overlapping requests, refreshes on
visibility return, and retains the last valid values when a refresh fails.

## Storage and indexes

Migration `0019_lightweight_customer_analytics.sql` adds `analytics_sessions`, nullable
`orders.analytics_visitor_id`, and nullable `orders.analytics_session_id`. Required indexes cover
recent activity, session starts, visitor/day guest association, authenticated activity, and
order-date conversion attribution. No raw browser characteristics or sensitive identity data is
stored in the analytics session.
