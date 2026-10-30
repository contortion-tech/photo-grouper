# Contributing to Photo Grouper

Thanks for your interest in contributing! Photo Grouper is a privacy-first, client-side photo collage maker, and contributions of all sizes are welcome — bug reports, new collage templates, filters, accessibility improvements, and docs.

## Core Principles

Any contribution should preserve the project's two non-negotiables:

1. **Privacy** — all image processing stays in the browser. No feature may upload, transmit, or persist a user's photos off-device.
2. **Offline capability** — the app must keep working as an installed PWA without a network connection.

## Development Setup

Requires **Node.js 20+**.

```bash
git clone https://github.com/namabeeru/photo-grouper.git
cd photo-grouper
npm install
npm run dev
```

Before opening a pull request, make sure the project builds and lints cleanly:

```bash
npm run lint
npm run build
```

## Workflow

1. Fork the repository and create a feature branch: `git checkout -b feat/my-change`.
2. Make your change in small, focused commits.
3. Run `npm run lint` and `npm run build`.
4. Open a pull request against `main` with a clear description of what changed and why.

## Code Style

- TypeScript throughout; keep types explicit at module boundaries.
- Follow the existing ESLint config (`npm run lint`).
- Match the conventions of the surrounding code — naming, file structure, and comment density.

## Adding a Collage Template

Templates are defined in [`utils/templates.ts`](utils/templates.ts). Each template implements the `CollageTemplate` interface with an `id`, `name`, `slots`, `aspectRatio`, and `style`. Slot positions are percentage-based so they reflow across output aspect ratios. When adding one:

- Pick a unique `id` and a clear `name`.
- Keep slot rectangles within bounds (0–100%) and non-overlapping unless intentional.
- Test it across a few output ratios in the editor.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how templates, per-slot edits, and canvas export fit together.

## Reporting Bugs

Open an issue with:

- What you expected vs. what happened.
- Steps to reproduce.
- Browser and OS (canvas export and Web Share behavior vary across browsers).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
