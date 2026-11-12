# Installation Guide — photogrouper-brand-v1

**Scope note (read first):** this bundle is the **approved SVG master set**.
PNG rendering — PWA icons (192/512/maskable 512), favicons (32/180),
`og-image.png` 1200×630 — is **DEFERRED to a post-gate mechanical step**,
rendered from the approved SVGs once the acceptance gates pass. Do not hand-draw
PNGs; rasterize from these SVGs only.

## 1. PWA / app icons (after PNG rendering)
- `icon/icon-192.png` → `public/icon-192.png`
- `icon/icon-512.png` → `public/icon-512.png`
- `icon/icon-maskable-512.png` → `public/icon-maskable-512.png` (Nine Frame kept
  inside the maskable safe zone — core motif within the inner 80% circle)
- `icon/favicon-32.png` → `public/favicon-32.png`
- `icon/favicon-180.png` → `public/favicon-180.png` (apple-touch)

Webmanifest mapping (`app/manifest.ts` or `public/manifest.json`):
```json
"icons": [
  {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
  {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
  {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
]
```
Head/apple-touch links in `app/layout.tsx`:
- `<link rel="icon" href="/favicon-32.png" sizes="32x32">`
- `<link rel="apple-touch-icon" href="/favicon-180.png">`

## 2. OG image
- Render `og/og-image.png` at 1200×630 from the approved light masthead
  composition (Nine Frame featured, generous safe margins).
- Replace `public/og-image.png` in place. The README already references it, so
  Open Graph metadata updates **without touching any route code**.

## 3. Masthead SVG (Home header slot)
- Stage `masthead/v1-nine-frame.svg` (light) / `v1-nine-frame-dark.svg` (dark)
  into the Home page header slot as `<Image>` or inline SVG, selected by the
  existing theme state. The other two versions are alternates for design
  review; ship exactly one.
- Respect height: the SVG is 640×96; scale to the container width.

## 4. Header glyph
- `glyph/header-glyph.svg` is the monochrome mark (`#2E3440` single color).
- Use as-is on light surfaces; for dark surfaces apply CSS
  `filter: invert(...)` or ship a lamp-white recolor — never add new colors
  to the file itself.

## 5. Tab icons — STAGED, NOT AUTO-APPLIED
Tab icons stay staged until a dedicated integration pass. Mapping to flow
stages:

| File | Flow stage |
|---|---|
| `tab/home.svg` | Home (landing) |
| `tab/library.svg` | Library (local gallery grid) |
| `tab/editor.svg` | Editor (collage editing) |
| `tab/bundle.svg` | Post bundle (numbered shortlist) |
| `tab/settings.svg` | Settings |

Each is single-color `#2E3440`, 20×20 viewBox, 1.8px stroke — template-style;
recolor at runtime, never by editing the files.

## 6. Empty states
- `empty/empty_library.svg` / `_dark` → Library view when no photos are loaded
  (gate on empty library/file list).
- `empty/empty_selection.svg` / `_dark` → Editor entry when fewer than 2
  photos are selected (gate on selection count).
- `empty/empty_bundle.svg` / `_dark` → Post bundle view when no saved bundle
  or empty shortlist (gate on bundle list length).

## 7. Verification checklist
- [ ] Every fill/stroke in every SVG uses ONLY the token hexes:
      `#FAFAF7 #FFFFFF #2E3440 #E3E1DA #F0685C #6FA98C #5C93C9 #22252B #2C3038 #F5F4EF`
- [ ] Zero `<text>` elements in any SVG.
- [ ] `header-glyph.svg` + all `tab/*.svg` are single-color.
- [ ] Every masthead and empty-state exists in BOTH light and dark.
- [ ] Contrast holds: ink-soft on paper-base ≥ 4.5:1; lamp-white on night-base ≥ 4.5:1.
- [ ] `MANIFEST.json` lists every file — no extras, no missing.
- [ ] `preview.html` renders all assets on both paper-base and night-base.
- [ ] No cloud, upload-arrow, or network imagery anywhere (privacy-first brand).
- [ ] **Must NOT touch (integration fence):** editor UI (73 layout presets,
      filter previews, crop/gap/radius controls), the Home → Selection → Editor
      flow chrome, button labels/tooltips, Post bundle / ZIP affordances.
      `public/og-image.png` is replaced only by the rendered og deliverable —
      no ad-hoc brand art scattered into routes.
- [ ] Tab icons remain staged-but-unused until the dedicated integration pass.

## Trademark
The Photo Grouper name and logo are not MIT-licensed (see TRADEMARK.md in the
app repo). These assets are for the canonical photogrouper.com app only; forks
must rebrand.
