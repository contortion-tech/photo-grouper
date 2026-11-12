# Photo Grouper — Brand Asset Generation Prompt (PG-BRAND-1)

Copy the block below into an image/design-capable LLM. It self-contains the contract.

---

## THE PROMPT

```text
You are a brand design studio. Produce a complete, installable brand asset
bundle for a web app called **Photo Grouper**, delivered as a single ZIP
file plus an installation guide. Dark AND light variants for everything
light-dependent.

### What the app is
Photo Grouper is a privacy-first, offline-capable Next.js PWA (photogrouper.com)
for turning 2–9 photos into a clean, shareable collage — entirely in the
browser. No account, no upload, no server-side processing; every pixel is
processed locally. Users are everyday people making Instagram-style collages
(1:1, 4:5, 9:16, 16:9 exports). Its personality: warm, calm, trustworthy —
a photo studio that fits in your hand. Not a tech dashboard, not a toy.

### The brand symbol (feature it HEAVILY)
The app's symbol is **The Nine Frame**: a 2×2 grid of soft rounded photo
tiles where one tile is tilted a few degrees and lifted, as if being placed
into the collage. This reads as "photos coming together". The symbol must be
the core of the app icon / PWA icon, echoed in the masthead (og-image and
header mark) and empty-states, and available as a standalone glyph. The
"tiles assembling, one lifted" reading must survive at 16×16 px.

### Design direction (non-negotiable)
- Feel: **warm photo studio** — soft paper-white surfaces, gentle depth
  (at most one soft shadow layer per tile), friendly rounded geometry.
- **NO baked-in text** inside any SVG. No generic AI-startup gradients.
  No glossy skeuomorphic 3D. No camera-clipart clichés.
- Rounded corners generous but consistent (10–16px equivalent), flat
  colors with at most subtle 2-stop same-hue shading.

### Color tokens (use ONLY these; do not invent hexes)
- paper-base    #FAFAF7   (light paper surface)
- paper-raised  #FFFFFF   (raised tile on light)
- ink-soft      #2E3440   (type/dark tile on light)
- frame-line    #E3E1DA   (hairlines, gaps between tiles)
- coral-accent  #F0685C   (the lifted tile / primary accent)
- sage-accent   #6FA98C   (secondary accent, filters/success)
- sky-accent    #5C93C9   (tertiary accent, links/info)
- night-base    #22252B   (dark surface body)
- night-raised  #2C3038   (raised tile on dark)
- lamp-white    #F5F4EF   (type on dark, lit glyph on dark)
Dark mode: night-base/night-raised surfaces, coral/sage/sky accents
unchanged, lamp-white type. The lifted tile stays coral in both modes.

### Surfaces the assets must NOT touch
The assets are ADDITIVE and STAGED. They must NOT restyle, replace, or
recolor:
1. The editor UI: layout templates (73 presets), filter previews
   (Mono, Noir, Sepia, …), crop/gap/radius controls.
2. The three-phase flow (Home → Selection → Editor) navigation chrome.
3. Any button labels, tooltips, or the Post bundle / ZIP export affordances.
4. The existing `public/og-image.png` must be replaced only by the new
   og-image deliverable — not by scattering ad-hoc brand art into routes.
Assets render only in: PWA icon set, favicon, og-image, header mark
(glyph only), and empty-states — wired per the installation guide.

### Deliverables (exact file names, inside photogrouper-brand-v1/)
PWA / APP ICON
  icon/icon-192.png icon/icon-512.png icon/icon-maskable-512.png
                                    Nine Frame as the hero, safe-zone padded
  icon/icon-light-512.png           light-mode styling variant
  icon/favicon-32.png favicon-180.png (apple-touch)
  icon/INSTALL.md                   where each file goes in the Next.js
                                    `public/` + webmanifest
OG IMAGE / MASTHEAD
  masthead/v1-nine-frame.svg        + v1-nine-frame-dark.svg
  masthead/v2-tilted-pair.svg       + v2-tilted-pair-dark.svg
  masthead/v3-photo-rail.svg        + v3-photo-rail-dark.svg
  Each: viewBox 640×96, Nine Frame motif integrated differently per
  version (v1: wordmark-free 2×2 frame block; v2: two large tiles, one
  tilted; v3: a horizontal rail of shrinking tiles with one lifted).
  tokens-only colors. No text elements.
  og/og-image.png                   1200×630, Nine Frame featured, light
                                    styling, generous safe margins
MENU BAR / HEADER GLYPH
  glyph/header-glyph.svg            24×24 viewBox, SINGLE color ink-soft
                                    #2E3440, monochrome, crisp at small size
TAB ICONS (template style, single color each, 20×20 viewBox, 1.5–2px stroke)
  tab/home.svg tab/library.svg tab/editor.svg tab/bundle.svg
  tab/settings.svg
  Concepts: home=grid of 4 tiles, library=stacked frames, editor=sliders
  (three lines with dots), bundle=numbered tray, settings=gear.
EMPTY-STATE ART (viewBox 320×200, ≤4 token colors, Nine Frame featured)
  empty/empty_library.svg empty/empty_selection.svg empty/empty_bundle.svg
  light + dark pair each (_dark suffix).

### Required ZIP structure
photogrouper-brand-v1.zip
├── MANIFEST.json        (array of {path, viewBox, tokensUsed[], dark|light, kind})
├── INSTALLATION_GUIDE.md (see below)
├── icon/ masthead/ og/ glyph/ tab/ empty/
└── preview.html         (contact sheet rendering every SVG at 1x, on both
                          paper-base and night-base backgrounds)

### INSTALLATION_GUIDE.md must contain
1. Where each icon file goes in `public/` and how it maps into the PWA
   webmanifest (192/512/maskable 512 + favicon + apple-touch).
2. How og-image.png replaces the existing `public/og-image.png` reference
   (Open Graph metadata) without touching route code.
3. How the masthead SVG is staged for the Home page header slot.
4. How header-glyph.svg is used as a monochrome mark.
5. Tab icons are STAGED, not auto-applied — list the flow stage each
   tab/<name>.svg maps to (Home, Library, Editor, Post bundle, Settings).
6. Empty states: which view each file belongs to and how to gate on an
   empty library / selection / bundle list.
7. A verification checklist mirroring the gates below, including the
   "must NOT touch" list and a privacy note: no asset may depict a cloud,
   upload arrow, or network imagery — the brand is offline-local.

### Acceptance gates (self-check before delivering)
1. Every fill/stroke in every SVG uses ONLY the token hexes above.
2. Zero <text> elements anywhere.
3. header-glyph.svg + all tab/*.svg are single-color.
4. Every masthead version has BOTH light and dark files.
5. Contrast: ink-soft #2E3440 on paper-base #FAFAF7 ≥ 4.5:1; lamp-white
   #F5F4EF on night-base #22252B ≥ 4.5:1.
6. All icon sizes present; the favicon-32 must still read as "tiles
   assembling, one lifted".
7. MANIFEST.json lists every file with no extras, no missing entries.
8. preview.html opens and renders all assets on both backgrounds.
9. No asset alters editor UI, flow chrome, or any surface in the
   "must NOT touch" list. No upload/cloud imagery anywhere.

Deliver: the ZIP (as a downloadable file) and a short summary of the three
masthead directions and how the Nine Frame was treated in each.
```

---

## Operator notes
- Source of truth: `photogrouper_README.md` in this directory. The privacy-first, offline, no-upload positioning is the brand's core claim — the palette and symbol are built to express it.
- Trademark note from the README: the Photo Grouper name and logo are NOT MIT-licensed; forks must rebrand. These assets are for the canonical app only.
- The three masthead versions requirement is standing policy for future bundle prompts.
- Integration remains gated: mechanical gates pass BEFORE any integration; tab icons stay staged-but-unused until a dedicated integration pass.
