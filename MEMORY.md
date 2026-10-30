# Photo Grouper — Local Project Memory

## Architecture Invariants

- **Multi-Page Bundle Data Model (Manifest v2 in `utils/bundles.ts`)**:
  - Shortlist is embedded directly inside multi-page bundles (up to 20 pages × ≤9 items per page).
  - Enforces backward compatibility: auto-migrates v1 manifests, restores legacy ZIPs, and projects `pages[0]` transparently.
  - IndexedDB storage schema preserves database name so existing user bundles remain intact.
- **Native Video Support & Offscreen Canvas Thumbnails**:
  - Ingests `.mp4`, `.mov`, `.webm`, `.m4v` up to 500 MB per file with zero cloud uploads.
  - `makeVideoThumbnail` in `utils/gallery.ts` seeks offscreen `<video>` to 25% duration and captures the frame to a WebP canvas blob, integrating smoothly with `ThumbnailPool`.
  - Fullscreen lightbox automatically switches to `<video controls autoPlay>` when opening video assets.
- **Instagram 10-Post Launch Planner**:
  - Numbered thumbnail strip slots `#01` through `#10` with `#01 · COVER` indicator for campaign curation.
  - Media filter dropdown (`All media`, `Photos only`, `Videos only`) with `▶ VIDEO` badge overlays.

## Resolved Bug Patterns

- **Offscreen Video Decoding Stalls on WebKit**:
  - Offscreen video frame capture requires `playsInline = true` and `muted = true` before calling `currentTime = seekTime`, otherwise WebKit blocks frame capture without error. Detaches event listeners immediately after capture.
- **Empty Page Prevention**:
  - Removed empty `addPage` affordance in `BundleEditor.tsx`; page creation must be driven strictly by media selection from the gallery.

## Verification & Status

- **Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 PWA.
- **Test Baseline**: 5/5 test suites passing (`bundles`, `gallery`, `layout-geometry`, `photo-edits`, `product-features`).
- **Build**: `tsc --noEmit` exits 0; `npm run build` verified clean.
