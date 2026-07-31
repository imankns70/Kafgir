# Kafgir branding and theme

## Brand and reference

The brand is **Kafgir / کفگیر**. It represents authentic Persian homemade food, warmth, family, trust, fresh ingredients, careful preparation, hygienic packaging, and reliable local delivery.

The primary atmosphere reference is `ka-2.png` at the repository root. The practical logo and component guide is `final-de.png`. Both are reference boards only and must not be embedded as application pages, backgrounds, food images, or sources of text.

## Identity source

`branding/logo.png` is the single source of truth for the Kafgir visual identity. It contains the approved flat four-slot cooking spatula, wooden handle, plate, olive branch, saffron accent, and terracotta rounded-square composition.

Do not redraw, recolor, stretch, or replace parts of the identity in application code. It is never substituted with a ladle, soup ladle, deep serving spoon, rounded slotted spoon, or soup-related utensil.

## Personality

- Warm, welcoming, local, family-oriented, modern, and clean without feeling corporate.
- Handmade character through restrained curves, leaves, saffron dots, and floral separators.
- Calm operational screens; decorations stay in brand, welcome, promotional, and empty-state areas.

Avoid fast-food saturation, luxury restaurant styling, dark restaurant themes, cold gray dashboards, gaming aesthetics, heavy shadows, and excessive ornament.

## Semantic colors

The reference swatches are terracotta `#E46A4A`, olive `#6F7F4E`, saffron `#F2B233`, cream `#FFF3E2`, beige `#EADCC0`, and charcoal `#2B2B2B`. Interactive terracotta and olive values are slightly darker so light button text meets normal-text contrast requirements.

| Token | Value |
| --- | --- |
| BrandPrimary / Hover / Pressed / Soft | `#C44D31` / `#B9472D` / `#A53D26` / `#FBE1D8` |
| BrandSecondary / Hover / Pressed / Soft | `#617044` / `#53613B` / `#465431` / `#E5EADB` |
| BrandAccent / Soft | `#F2B233` / `#FFF0C8` |
| Background / BackgroundSecondary | `#FFF3E2` / `#F8E9D3` |
| Surface / SurfaceElevated / SurfaceMuted | `#FFFAF3` / `#FFFFFF` / `#EADCC0` |
| Border / BorderStrong | `#E5D5BB` / `#CBB997` |
| TextPrimary / Secondary / Muted | `#2B2B2B` / `#626057` / `#716D63` |
| TextOnPrimary / TextOnSecondary | `#FFFDF9` / `#FFFDF9` |
| Success / SuccessSoft | `#4F6F3A` / `#E5EBD9` |
| Warning / WarningSoft | `#8B5E00` / `#FFF0C8` |
| Error / ErrorSoft | `#B33A32` / `#FBE2DE` |
| Info / InfoSoft | `#496A70` / `#E2EEF0` |
| Disabled / Focus | `#B9B0A2` / `#A7432E` |
| Overlay / Shadow base | `rgba(43,43,43,.58)` / `rgba(93,61,42,.12)` |

Do not introduce repeated literal colors inside views or components. Add or adjust a semantic token in both platforms.

## Typography

The repository contains licensed Vazir Regular, Medium, and Bold WOFF2 assets used by both React applications. No operating-system font or font CDN is required.

IranSans and IranYekan files are not present and were not downloaded. Vazir remains replaceable through centralized CSS `@font-face` definitions.

Use real bundled weights only: Regular 400, Medium 500, and Bold 700. Do not synthesize weight 600.

Roles are BrandTitle 32, HeroTitle 30, DisplayTitle 28, PageTitle 24, SectionTitle 19, CardTitle 17, DialogTitle 20, BodyLarge 16, Body 15, BodySmall 13, Caption 12, Label 14, ButtonText 15, NavigationText 14, PriceLarge 24, Price 18, and StatusText 12.

## Layout

- Spacing: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Radius: Small `8`, Medium `12`, Large `16`, ExtraLarge `20`, Pill fully rounded.
- Shadows: subtle warm Card, Floating, Dialog, and Navigation roles.
- Motion: 140–200ms. React respects `prefers-reduced-motion`.

## Logo and generated assets

- Canonical source: `branding/logo.png`.
- Transparent-corner runtime logo: generated into each application's `/branding/logo.png`.
- Web assets: favicon PNGs, multi-resolution `favicon.ico`, Apple touch icon, and PWA PNGs from 16 through 512 pixels.
- Electron asset: multi-resolution `apps/admin/build/kafgir.ico`.
- Neutral food fallback: `branding/illustrations/food-placeholder.svg`. This is an illustration, not a logo or identity variant.

Run `scripts/generate-kafgir-icons.ps1` after replacing the canonical source. The script deterministically preserves aspect ratio, removes only the opaque outer canvas corners, creates all runtime sizes, and copies them into Next.js and Electron. Do not maintain parallel SVG logo variants.

## Icon style

Application icons use a 24×24 outline grid, 1.8px strokes, rounded caps, rounded joins, and `currentColor` or semantic brushes. Terracotta represents active actions, olive represents secondary or inactive navigation, and saffron is a restrained accent. Do not mix emoji, unrelated filled icon sets, or random icon colors.

The supplied brand image is the intentional filled exception to the outline UI icon system.

## Application themes

The Mini App design system is under `apps/web/src/client`; tokens, fonts, RTL rules, reusable logo/icon/state components, food imagery, and responsive navigation remain centralized there.

The Electron admin theme is under `apps/admin/src/renderer/src`. It reuses the same palette, typography, RTL direction, status meanings, rounded surfaces, and focus behavior while prioritizing dense operational layouts.

Both applications keep phone numbers and identifiers locally LTR where necessary. Food images use a consistent aspect ratio and `object-fit: cover`; failed or missing images use the neutral food placeholder, never the complete logo or brand symbol.

## Order statuses

Enum values are unchanged. Both applications map them as follows:

| Status | Persian label | Tone |
| --- | --- | --- |
| PendingConfirmation | در انتظار تایید | Warning |
| Confirmed | تایید شده | Terracotta primary |
| Preparing | در حال آماده‌سازی | Saffron warning |
| Ready | آماده تحویل | Info/olive |
| Delivered | تحویل شده | Success |
| Cancelled | لغو شده | Error |

Badges include Persian text and may include an outline icon, so status is not communicated by color alone.

## Correct usage

- Use only `branding/logo.png` and its generated derivatives for application identity.
- Use cream surfaces, terracotta actions, olive natural accents, and limited saffron details.
- Keep food photography warm, realistic, naturally lit, correctly cropped, and free of stretching.
- Keep Electron operational grids calm and decorations sparse.
- Preserve visible focus, readable contrast, touch targets, and keyboard navigation.

## Incorrect usage

- Never use a ladle, soup spoon, rounded serving spoon, slotted spoon, or bowl-shaped utensil.
- Never use `ka-2.png` as a page, background, or food image.
- Never extract malformed reference-image text.
- Never restore the old blue/purple Vite identity or remote font CDN.
- Never introduce a second hand-built logo or substitute interface icon as the brand mark.
- Never duplicate semantic colors per page.
- Never add decorative leaves or floral marks to every operational control.
