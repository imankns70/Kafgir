# Telegram Mini App

The customer-facing Mini App is implemented inside `apps/web` using Next.js App Router.

It:

- loads Telegram's Web App SDK and calls `ready()`/`expand()`;
- uses Telegram's Back button for cart and success navigation;
- reads the daily menu through same-origin `GET /api/menus/today`;
- loads active category filters from PostgreSQL and links food cards to `/foods/[slug]`;
- shows customer-safe food details, visible tags, a single primary badge, gallery images, related available foods, and server-derived orderability;
- supports idempotent authenticated likes and favorites and a current-customer favorites endpoint;
- persists and reconciles the cart against current menu availability and price;
- preloads returning customer profiles and saved addresses;
- submits orders with validated Telegram `initData`;
- exchanges validated Telegram `initData` for the same HttpOnly customer session used by browser login;
- supports SMS.ir mobile OTP login outside Telegram, customer profile/address editing, and personal
  order history with protected details;
- works in a normal browser during configured local development;
- uses local Vazir fonts, Persian RTL layout, safe-area mobile navigation, and the shared Kafgir brand system.

Server configuration uses `TELEGRAM_BOT_TOKEN`, `TELEGRAM_REQUIRE_INIT_DATA`, and `TELEGRAM_INIT_DATA_MAX_AGE_MINUTES`. Production must require validated `initData`.

Browser OTP configuration uses `SMS_PROVIDER=smsir`, `SMSIR_API_KEY`, `SMSIR_TEMPLATE_ID`,
`SMSIR_CODE_PARAMETER`, and a separate 32-character `CUSTOMER_OTP_SECRET`. The `console` SMS
adapter is development-only. Customer cookies are HttpOnly, SameSite=Lax, secure in production,
and valid only for the customer JWT audience.
