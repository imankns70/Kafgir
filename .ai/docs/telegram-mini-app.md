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

## Private Telegram testing through Pinggy

Pinggy exposes only the Next.js customer application on local port `3000`. Never tunnel the
Electron renderer, PostgreSQL, pgAdmin, upload directory, or logs. Start the customer application
without Electron:

```powershell
npm run dev:web
```

In another terminal, start the existing Pinggy tunnel with `localhost:3000` as its target. Copy
the generated HTTPS URL, then update the Telegram bot's default menu button:

```powershell
npm run telegram:configure -- -MiniAppUrl https://your-current-host.pinggy.link
```

The helper accepts only an allowed Pinggy HTTPS hostname, verifies the public Kafgir health route,
loads `TELEGRAM_BOT_TOKEN` from the current environment or the ignored `apps/web/.env.local`,
verifies the bot, and calls Telegram's `setChatMenuButton`. It never prints or persists the token.
Run it after every free Pinggy URL change.

Create the bot once through BotFather and keep its token only in `apps/web/.env.local`. Private
Telegram testing requires `TELEGRAM_REQUIRE_INIT_DATA=true`. Pin the stable
`https://t.me/<bot-username>` address in the channel; testers open the bot and select
`باز کردن کفگیر`. Do not publish the raw Pinggy URL as the channel entry point because that opens
an ordinary browser page without Telegram-signed `initData`.

Before inviting testers, verify `/api/health`, silent Telegram profile login, menu and food images,
cart/checkout, personal order history, Electron order visibility, and notification delivery. A raw
browser visit must not acquire Telegram identity, and altered or expired `initData` must be rejected.
Pinggy is a private-testing bridge only; use the stable Liara HTTPS deployment for public launch.
