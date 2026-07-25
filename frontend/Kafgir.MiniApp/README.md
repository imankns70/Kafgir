# Kafgir Telegram Mini App

Customer-facing React, TypeScript, and Vite application for viewing today's menu, managing a cart, loading saved customer details, and submitting orders.

The UI bundles the repository's licensed Vazir Regular, Medium, and Bold files locally. It does not require a remote font service. Shared Kafgir tokens, components, icons, and RTL rules live under `src/styles` and `src/design-system`.

## Local development

1. Start `Kafgir.Api` with its HTTPS profile at `https://localhost:7279`.
2. Trust the local ASP.NET Core HTTPS certificate if the browser has not accepted it yet.
3. Install and run the Mini App:

```powershell
npm ci
npm run dev
```

The Development API configuration allows `http://localhost:5173`. Override the API address by creating an ignored `.env.local` file:

```text
VITE_API_BASE_URL=https://localhost:7279
```

## Verification

```powershell
npm run lint
npm run build
```

## Telegram and production

The page loads Telegram's Web App SDK from `telegram.org`, calls `ready()` and `expand()`, and uses the native Back button. Local browser development works without Telegram and uses the backend's Development identity fallback.

Production requires an HTTPS deployment URL registered with the Telegram bot, `VITE_API_BASE_URL` pointing to the deployed API, and that exact frontend origin in the API `Cors:AllowedOrigins` configuration. Telegram `initData` must remain required outside Development.
