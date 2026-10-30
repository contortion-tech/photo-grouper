# Privacy Policy

**Effective date:** June 15, 2026

Photo Grouper is built privacy-first. This policy explains, in plain language, what happens to your data when you use the app at [photogrouper.com](https://photogrouper.com).

## The short version

- **Your photos never leave your device.** All processing happens locally in your browser.
- **No account, no sign-up.** We don't ask for your name, email, or any personal details.
- **No photo uploads, ever.** There is no server that receives, stores, or sees your images.
- The only data collected is **anonymous, aggregated usage analytics** on the official hosted site — and even that is turned off in self-hosted copies by default.

## Your photos

When you add photos, they are read directly by your browser and held in your device's memory for the current session unless you explicitly save a named post bundle. They are:

- **Processed entirely on-device** — compression, editing, filters, layout, and final export all run as client-side JavaScript using the HTML Canvas API.
- **Never transmitted** — no photo, thumbnail, or derived image is sent to Photo Grouper, our host, or any third party.
- **Local drafts only when saved** — ordinary gallery files are session-only. Saving a named post bundle stores its selected originals, filenames, order and crop settings in IndexedDB on this browser. These drafts survive reload until browser data is cleared or removed by the browser. Export ZIP backups for recovery. Nothing is saved to a server.

## What we collect

On the **official hosted site** ([photogrouper.com](https://photogrouper.com)):

- **Vercel Web Analytics** — anonymous, aggregated usage data such as page views and general device, browser, and country-level information. It does not use tracking cookies, does not follow you across other sites, does not collect your photos, and does not identify you personally. See [Vercel's analytics privacy documentation](https://vercel.com/docs/analytics/privacy-policy).
- **Standard server logs** — our hosting provider (Vercel) processes routine request metadata (such as IP address and browser user-agent) for the sole purpose of delivering the web page to you, as happens with essentially any website.

## What we do **not** collect

- Your photos or anything derived from them.
- Names, email addresses, or account credentials (there are no accounts).
- Precise location.
- Cross-site tracking or advertising profiles.

## Cookies & local storage

Gallery view preferences (tile shape, size, spacing, fit, labels and sorting) are stored in localStorage. Ordinary library files and collage edits are session-only. Explicitly saved named bundles store selected original photos, filenames, ordering and crop settings in local IndexedDB. Bundle ZIP backups retain original embedded metadata; optional posting copies are rendered locally.

Photo Grouper does not use tracking or advertising cookies. As a Progressive Web App, it uses a service worker to cache the application's own code and assets so it can work offline — this cache contains app files, **not** your photos.

## Fonts & third parties

- **Fonts are self-hosted.** The app serves its fonts from its own domain and does not make requests to Google Fonts at runtime.
- The only third party involved in the hosted site is **Vercel**, which provides hosting and the optional analytics described above.

## Self-hosted and forked versions

Photo Grouper is open source, and anyone can run their own copy. In self-hosted or forked deployments, analytics is **disabled by default** and only runs if the operator explicitly opts in. If you use a copy hosted by someone else, their data practices — not this policy — apply.

## Children's privacy

Photo Grouper does not knowingly collect personal information from anyone, including children, because it does not collect personal information at all.

## Changes to this policy

If this policy changes, the updated version will be posted here with a revised effective date.

## Contact

Questions about privacy? Open an issue on [GitHub](https://github.com/namabeeru/photo-grouper/issues).
