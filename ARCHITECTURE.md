# Photo Grouper - Architecture

> **AI AGENT INSTRUCTION**: You must read this file before starting any major refactor. If you change the tech stack or add a new major feature, you MUST update this file to reflect the new state of the project.

---

## Project Overview

**Photo Grouper** is a privacy-first photo collage maker web application. It allows users to create beautiful photo collages without uploading photos to any server. All image processing happens locally in the browser.

### Core Philosophy
- **Privacy-First**: Photos never leave the user's device
- **Offline-Capable**: Works as a PWA with service worker support
- **Client-Side Processing**: All image manipulation happens in the browser

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | Next.js (App Router) | 16.2.10 |
| **UI Library** | React | 19.2.7 |
| **Language** | TypeScript | ^5 |
| **Styling** | Tailwind CSS | ^4 |
| **Icons** | Lucide React | ^0.561.0 |
| **Image Compression** | browser-image-compression | ^2.0.2 |
| **PWA** | @ducanh2912/next-pwa | ^10.2.9 |
| **Build Tool** | Turbopack (development), webpack (production PWA build) | - |

---

## Project Structure

```
photo-grouper/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout with metadata & fonts
│   ├── page.tsx            # Main page component (state machine)
│   ├── globals.css         # Global styles
│   └── favicon.ico         # App favicon
├── components/             # React components
│   ├── HomePage.tsx        # Landing/welcome screen
│   ├── PhotoSelection.tsx  # Photo picker & grid
│   ├── CollageEditor.tsx   # Collage layout editor
│   └── InstallPrompt.tsx   # PWA install prompt
├── utils/                  # Utility functions
│   ├── templates.ts        # Collage template definitions
│   ├── photoEdits.ts       # Per-slot edit + filter types and presets
│   └── collageGenerator.ts # Canvas-based collage rendering
├── types/
│   └── photo.ts            # Shared local photo model
├── public/                 # Static assets
│   ├── site.webmanifest    # PWA manifest
│   ├── apple-touch-icon.png
│   ├── android-chrome-*.png
│   └── favicon-*.png
├── next.config.ts          # Next.js + PWA configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies & scripts
```

---

## Application Flow

The app operates as a **three-phase state machine**:

```
┌──────────┐    Select    ┌─────────────┐    Group It    ┌──────────┐
│   Home   │ ──────────▶ │  Selection  │ ────────────▶ │  Editor  │
└──────────┘    Photos    └─────────────┘                └──────────┘
                                │                             │
                                │◀────── Cancel ──────────────┘
```

| Phase | Component | Description |
|-------|-----------|-------------|
| `home` | `HomePage.tsx` | Welcome screen with "Select Photos" CTA |
| `selection` | `PhotoSelection.tsx` | Photo picker with add/remove functionality |
| `editor` | `CollageEditor.tsx` | Template selection, photo arrangement, save |

The selection phase accepts both the system file picker and desktop drag-and-drop. The editor
keeps its touch-first bottom tool tray on small screens and uses a persistent right-side inspector
on desktop so the canvas and controls remain visible together.

---

## Key Features

### Gallery ownership

`PhotoSelection.tsx` owns the session-only library, selected asset IDs, filters and virtual grid.
It stays mounted while the editor is open, preserving browsing position and library references.
`utils/gallery.ts` owns preference validation, selection rules, grid geometry and the bounded
thumbnail decode/cache pool. The gallery does not use the collage photo array as its library.

The library holds File references rather than decoded originals. Visible tiles own temporary
thumbnail object URLs, and the pool caches at most 128 thumbnail blobs. Two decode jobs run at
once. Metadata indexing is progressive. The lightbox creates session object URL references and
preloads only adjacent full images; closing it revokes those URLs. Leaving the library disposes
the thumbnail pool. Unsupported files are surfaced, and imports above 25 MB are skipped.

The selected File objects alone cross into `PhotoGrouperApp.tsx`; successful handoff replaces
its previous prepared set atomically. Selected originals are decoded for validation, retained
without compression, and exported through the existing canvas pipeline. Existing workflow
routes and editor controls remain in place. Preference storage contains no file identities.

### 1. Original-image handoff
- Validates selected originals sequentially before opening the editor.
- Retains original resolution; thumbnails are generated separately for gallery browsing.
- The compression dependency/worker remains available for compatibility but is no longer used on import.

### 2. Collage Templates
- Defined in `utils/templates.ts`
- Support for 2-9 photos with many layout options each (~4-7 per count)
- Each template has: `id`, `name`, `slots`, `aspectRatio`, `style`
- Styles: `clean`, `polaroid`, `rounded`, `artistic`

### 3. Per-Photo Editing (Adjust tab + touch gestures)
- Each slot can be tapped to open inline edit controls
- Adjustments: rotation, zoom (scale), pan (offsetX/Y), brightness, contrast,
  saturation, blur
- **Touch gestures** (Pointer Events on each slot in `EditableSlot`):
  - tap → select the slot
  - one-finger drag → reposition (pan) the photo, at any zoom level
  - two-finger pinch → zoom (pan follows). Rotation is intentionally NOT part
    of the pinch, to avoid the accidental "skew" that twisting introduces;
    rotate precisely via the Adjust buttons/slider instead.
  - long-press (~400ms, with haptic) → arm the slot for swapping; the next tap
    on another slot swaps them. A "Swap…" button in the Adjust tab arms it too.
    Swap is an explicit mode so it never conflicts with pan/zoom (the earlier
    drag-to-swap broke once a photo was zoomed, since drag then meant "pan").
- **Pan is bounded** (`maxOffsetPct` / `clampOffsets` in `utils/photoEdits.ts`):
  offsets are clamped to the image's overflow so panning never reveals empty
  space, and zooming back out re-clamps so edges that were pushed off-frame
  return into view. A `ResizeObserver` re-clamps on layout/aspect changes.
- Edits are stored as a `Map<slotId, PhotoEdits>` in page-level state
- Reset clears the slot back to defaults
- Reassigning a layout resets all edits (slot IDs may not map cleanly)

### 4. Instagram-Style Filters (Filters tab)
- Defined in `utils/photoEdits.ts` (`FILTER_OPTIONS`, `FILTER_PRESETS`)
- Presets: Mono, Noir, Sepia, Vintage, Fade, Warm, Cool, Vivid, Dramatic,
  Cinematic, Pastel, Lush, Matte (plus Original)
- Live thumbnails per preset render the selected photo with the filter via
  CSS `filter`
- `Apply to all` propagates the active filter to every slot
- Canvas export uses `ctx.filter` so JPEG output matches preview

### 5. Output Aspect Ratio (Format tab)
- `ASPECT_PRESETS` in `utils/photoEdits.ts` — platform-targeted ratios
  (Instagram 1:1 / 4:5, Story 9:16, YouTube/X 16:9, Pinterest 2:3,
  Facebook 1.91:1, 4:3, plus "Layout" = the template's own ratio)
- Stored as `outputAspectRatio: number | null` in page state; because slots
  are percentage-based they reflow to whatever ratio is chosen
- Applied to both the editor preview and the export canvas

### 6. Collage Style (Style tab)
- Background colour swatches + free colour picker
- Sliders for photo gap, corner radius, outer padding
- Stored as `CollageStyle` in page-level state, applied both in editor and
  during export

### 7. Canvas-Based Export
- `utils/collageGenerator.ts` renders collages using HTML Canvas API
- Preloads all photos in parallel (`preloadImages`) before drawing
- Replicates the CSS pipeline: cover-fit → clamped translate → scale → rotate,
  then applies `ctx.filter` and clips with rounded rects
- Honors the output aspect-ratio override
- Editor px values (gap/padding/radius) scale via
  `EXPORT_WIDTH / REFERENCE_WIDTH (448)` so output matches preview

### 7. PWA Support
- Configured via `@ducanh2912/next-pwa` in `next.config.ts`
- Service worker generated for offline capability
- Web manifest at `/public/site.webmanifest`

---

## State Management

- **No external state library** - Uses React's built-in `useState` and `useCallback`
- All state is managed in `app/page.tsx` and passed down as props
- Key state:
  - `phase`: Current app phase (`home` | `selection` | `editor`)
  - `photos`: Array of `PhotoData` objects with file & preview URL
  - `selectedTemplate`: Currently active collage template
  - `photoAssignments`: `Map<slotId, photoIndex>`
  - `slotEdits`: `Map<slotId, PhotoEdits>` — per-slot rotation/zoom/pan/filter
  - `collageStyle`: `CollageStyle` — background, gap, corner radius, padding

---

## Styling

- **Tailwind CSS v4** for utility-first styling
- **Geist font family** (Sans + Mono) via `next/font/google`
- Dark theme by default (`#1a1a2e` theme color)

---

## Development Commands

```bash
npm run dev     # Start dev server (Turbopack)
npm run build   # Production build (webpack, required for service-worker generation)
npm run start   # Start production server
npm run lint    # Run ESLint
```

---

## Deployment

- Designed for static/edge deployment
- Recommended platform: **Vercel**
- Live instance: **[photogrouper.com](https://photogrouper.com)**
- No server-side data storage or API routes

---

## Future Considerations

When adding new features, consider:

1. **Maintain Privacy**: Any new feature must continue to process data client-side only
2. **PWA Compatibility**: Ensure new features work offline
3. **Template System**: New layouts should follow the `CollageTemplate` interface
4. **Performance**: Use image compression and web workers for heavy operations

### Gallery ordering and editable layouts

Library manual order and collage selection order are separate session state. Drag grips and
keyboard arrows move entries before their targets; filtering preserves hidden entries. Palette
sampling runs during bounded thumbnail decoding and retains only small RGB summaries in metadata.
Colour suggestions are a preview until applied; they neither classify people nor alter files.

`utils/layoutGeometry.ts` discovers safe shared divider segments. `CollageEditor` uses those
segments for pointer and keyboard resize. The parent updates template geometry directly so
photo assignments and edits survive resizing, and the same geometry reaches canvas export.
Selecting a different preset retains the existing reset behavior.

### Named post bundles

`PhotoSelection` owns separate collage/bundle selections, mode, saved-bundle navigation and the
current bundle draft. `BundleEditor` owns presentation, operation feedback and crop interaction;
its draft is controlled by the gallery. `utils/bundles.ts` owns validation, shared crop geometry,
JPEG rendering, IndexedDB transactions and versioned ZIP export/restore. Collage template state
and its 2–9-photo limits remain independent.

Persistence is additive: IndexedDB database `photo-grouper-bundles-v1`, store `bundles`. Only an
explicit successful Save marks a draft saved; quota/transaction failures retain in-memory state.
Original File payloads, order, nickname and per-image crop settings are saved atomically together.
Portable backups contain originals and a checked manifest, with optional posting copies and a
separate contact sheet. Restores create a new bundle identity rather than overwriting old drafts.
Canvas posting export and previews use the same crop placement helper.
