# Kafgir branding and theme

## Brand and reference

The brand is **Kafgir / کفگیر**. It represents authentic Persian homemade food, warmth, family, trust, fresh ingredients, careful preparation, hygienic packaging, and reliable local delivery.

The primary atmosphere reference is `ka-2.png` at the repository root. The practical logo and component guide is `final-de.png`. Both are reference boards only and must not be embedded as application pages, backgrounds, food images, or sources of text.

## Symbol

The Kafgir symbol is a flat slotted cooking turner with a softly rounded rectangular head, four long vertical slots, and a warm wooden handle. The friendly handcrafted silhouette must remain clear at small sizes.

It is never a ladle, soup ladle, deep serving spoon, rounded slotted spoon, or soup-related utensil. This applies to logos, favicons, application icons, navigation, empty states, packaging badges, and future generated assets.

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

The repository contains licensed Vazir Regular, Medium, and Bold assets. WPF embeds TTF; React embeds WOFF2. No operating-system font or font CDN is required.

IranSans and IranYekan files are not present and were not downloaded. Vazir remains replaceable through centralized `AppFontFamily` and CSS `@font-face` definitions.

Use real bundled weights only: Regular 400, Medium 500, and Bold 700. Do not synthesize weight 600.

Roles are BrandTitle 32, HeroTitle 30, DisplayTitle 28, PageTitle 24, SectionTitle 19, CardTitle 17, DialogTitle 20, BodyLarge 16, Body 15, BodySmall 13, Caption 12, Label 14, ButtonText 15, NavigationText 14, PriceLarge 24, Price 18, and StatusText 12.

## Layout

- Spacing: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Radius: Small `8`, Medium `12`, Large `16`, ExtraLarge `20`, Pill fully rounded.
- Shadows: subtle warm Card, Floating, Dialog, and Navigation roles.
- Motion: 140–200ms. React respects `prefers-reduced-motion`.

## Logo and generated assets

Canonical assets live in `branding/`:

- Symbol-only assets: `kafgir-symbol.svg`, `kafgir-symbol-light.svg`, `kafgir-symbol-dark.svg`, and `kafgir-symbol-small.svg`.
- App assets: `kafgir-app-icon.svg`.
- Secondary assets: `kafgir-brand-badge.svg`, `kafgir-food-placeholder.svg`, and `kafgir-decoration.svg`.
- `generated/` PNG sizes from 16 through 512 and the WPF multi-resolution ICO.

Run `scripts/generate-kafgir-icons.ps1` to regenerate raster icons. Small icons contain no text and prioritize the slotted rectangular head.

React renders the wordmark as real HTML Vazir text through `BrandLogo`. WPF renders it as a real Vazir `TextBlock`. SVG assets must not contain the Persian wordmark as `<text>` or paths, and the symbol/app-icon assets remain symbol-only.

The WPF project has no native SVG dependency. Its logo templates therefore use the transparent `Assets/Brand/kafgir-symbol.png` generated from the same canonical script and compose it with a real Persian `TextBlock`. This generated file must not be edited by hand.

## Icon style

Application icons use a 24×24 outline grid, 1.8px strokes, rounded caps, rounded joins, and `currentColor` or semantic brushes. Terracotta represents active actions, olive represents secondary or inactive navigation, and saffron is a restrained accent. Do not mix emoji, unrelated filled icon sets, or random icon colors.

The brand symbol is the intentional filled exception: flat charcoal head, cream slots, and wooden handle.

## WPF theme

The WPF theme is under `backend/src/Kafgir.WPF/Themes/Kafgir`: `Colors`, `Dimensions`, `Typography`, `Icons`, `Controls`, `Surfaces`, `DataGrid`, `Navigation`, and the merging `KafgirTheme` dictionary.

`App.xaml` merges the theme. Common controls, navigation, cards, feedback panels, DataGrids, typography, status badges, and focus/disabled states reuse these resources. Application icon configuration is in `Kafgir.WPF.csproj`.

WPF remains RTL at Window/UserControl level. Phone and order-number inputs use local LTR flow only where required. Existing Persian culture, numeric, and date behavior is unchanged.

## React theme

React tokens are in `src/styles/tokens.css`; fonts and root RTL rules are in `src/index.css`; application components and responsive behavior are in `src/App.css`.

Reusable components in `src/design-system` are `BrandLogo`, `Icon`, `StatusBadge`, `FoodImage`, and `BrandedState`.

`index.html` is `lang="fa"` and `dir="rtl"`, uses local fonts, and references the Kafgir favicon. Mobile navigation uses existing Menu, Categories, and Cart actions, supports safe areas, and has no decorative center action. Logical CSS properties are preferred. Food images use a consistent aspect ratio and `object-fit: cover`; failed or missing images use the neutral food placeholder, never the complete logo or brand symbol.

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

- Use the flat slotted turner and real Persian word `کفگیر`.
- Use cream surfaces, terracotta actions, olive natural accents, and limited saffron details.
- Keep food photography warm, realistic, naturally lit, correctly cropped, and free of stretching.
- Keep WPF operational grids calm and decorations sparse.
- Preserve visible focus, readable contrast, touch targets, and keyboard navigation.

## Incorrect usage

- Never use a ladle, soup spoon, rounded serving spoon, slotted spoon, or bowl-shaped utensil.
- Never use `ka-2.png` as a page, background, or food image.
- Never extract malformed reference-image text.
- Never restore the old blue/purple Vite identity or remote font CDN.
- Never put a full wordmark in tiny icons.
- Never duplicate semantic colors per page.
- Never add decorative leaves or floral marks to every operational control.
