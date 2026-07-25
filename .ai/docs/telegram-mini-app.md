# Telegram Mini App

The Mini App is the customer-facing ordering experience.

The page loads Telegram's Web App SDK, signals `ready()`, expands to the available viewport, and uses Telegram's native Back button when the customer is viewing the cart or order-success page. Outside Telegram, these integrations safely become no-ops so local browser development still works.

Persian UI typography uses local licensed Vazir WOFF2 files in Regular, Medium, and Bold weights. The Mini App has no font-CDN dependency.

The customer theme reuses the WPF Kafgir identity while remaining mobile-first: warm cream canvas, food-paper surfaces, charcoal typography, accessible terracotta actions, olive navigation, saffron accents, and semantic status colors. It uses a sticky branded header, flat slotted-turner mark, warm menu introduction, consistent food cards and fallbacks, responsive checkout, and a safe-area Menu/Cart bottom navigation on phones.

Entrance motion is intentionally restrained to 150-220ms and disabled through `prefers-reduced-motion` when requested by the device. Shared colors, spacing, shadows, and responsive rules live in `src/App.css` and `src/index.css`; components should reuse those tokens rather than defining isolated visual systems.

## Customer flow

1. Open the Mini App.
2. View the daily menu.
3. Add foods to the cart.
4. Enter customer information and address.
5. Submit the order.
6. Wait for admin confirmation.

Telegram `initData` validation is implemented on the backend for customer profile preload and order submission.

The first MVP customer UI is implemented:

- Customer can view today's menu.
- Customer can add food to cart and update quantities.
- Cart contents survive page refreshes in browser storage and are reconciled against the latest menu so removed, unavailable, sold-out, or repriced items cannot remain stale.
- Customer can enter delivery details and submit an order.
- The Mini App sends raw `Telegram.WebApp.initData` during checkout and profile preload. The backend validates its HMAC hash and freshness before trusting Telegram user identity.
- Returning customers receive their saved profile and active address data through `POST /api/customers/me`.
- Checkout prefills saved name/phone data and allows selecting a previous address or adding and optionally saving a new delivery destination.

Today's menu is loaded from the public backend endpoint `GET /api/menus/today`. Admin-only menu management remains under protected `/api/admin/daily-menus/...` routes.

Returning customer data is loaded with `POST /api/customers/me`. The request sends `telegramInitData`; local Development can also send raw Telegram user fields only when backend validation is not required. A missing profile returns `404`, which the Mini App treats as a first-time customer.

Validated Telegram user and chat metadata is stored in the `TelegramAccounts` table. Customer profile and address data remain separate business records.

## Backend configuration

Set `Telegram:BotToken` from BotFather in a secure configuration source. `Telegram:InitDataMaxAgeMinutes` controls freshness; the default is 1440 minutes. Missing `initData` is rejected outside the Development environment. In Development, missing `initData` can fall back to raw Mini App user fields only when `Telegram:RequireInitData` is `false`.

The frontend API URL comes from `VITE_API_BASE_URL`; local Development defaults to `https://localhost:7279`. Browser origins are allowed through the API's `Cors:AllowedOrigins` configuration. Production must add only the deployed HTTPS Mini App origin.

For notifications, the same bot token is used by `Kafgir.Worker` to call Telegram Bot API `sendMessage`. Customers must have opened or interacted with the bot before Telegram allows the bot to send them direct messages.

Set `Telegram:AdminChatId` to a private admin chat, group, or channel ID to receive order-submitted notifications. If it is empty, admin notification enqueueing is skipped.
