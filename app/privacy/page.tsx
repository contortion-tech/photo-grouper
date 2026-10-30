import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Photo Grouper handles your data: photos are processed entirely in your browser and never uploaded. No account, no tracking cookies.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 leading-relaxed text-slate-700">
      <Link
        href="/"
        className="text-sm font-medium text-indigo-600 hover:underline"
      >
        ← Back to Photo Grouper
      </Link>

      <h1 className="mt-8 text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Effective date: July 22, 2026</p>

      <p className="mt-6">
        Photo Grouper is built privacy-first. This policy explains, in plain
        language, what happens to your data when you use the app at{" "}
        <a
          href="https://photogrouper.com"
          className="text-indigo-600 hover:underline"
        >
          photogrouper.com
        </a>
        .
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">
        The short version
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <strong>Your photos never leave your device.</strong> All processing
          happens locally in your browser.
        </li>
        <li>
          <strong>No account, no sign-up.</strong> We don&apos;t ask for your
          name, email, or any personal details.
        </li>
        <li>
          <strong>No photo uploads, ever.</strong> There is no server that
          receives, stores, or sees your images.
        </li>
        <li>
          The only data collected is{" "}
          <strong>anonymous, aggregated usage analytics</strong> on the official
          hosted site — and even that is turned off in self-hosted copies by
          default.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">Your photos</h2>
      <p className="mt-3">
        When you add photos, they are read directly by your browser and held
        in your device&apos;s memory for the current session unless you explicitly save a named post bundle. They are:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <strong>Processed entirely on-device</strong> — compression, editing,
          filters, layout, and final export all run as client-side JavaScript
          using the HTML Canvas API.
        </li>
        <li>
          <strong>Never transmitted</strong> — no photo, thumbnail, or derived
          image is sent to Photo Grouper, our host, or any third party.
        </li>
        <li>
          <strong>Local drafts when saved</strong> — ordinary library photos are session-only.
          Saving a named post bundle stores its selected original photos, filenames, order and
          crop settings in this browser&apos;s IndexedDB. Export a ZIP backup for recovery if
          browser data is cleared. Nothing is saved to a server.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">
        What we collect
      </h2>
      <p className="mt-3">
        On the official hosted site (
        <a
          href="https://photogrouper.com"
          className="text-indigo-600 hover:underline"
        >
          photogrouper.com
        </a>
        ):
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <strong>Vercel Web Analytics and product events</strong> — anonymous,
          aggregated usage data such as page views, workflow route, number of
          photos used, export format and size, export success, and an optional
          post-export category you choose. These events do not include
          filenames, labels, image dimensions, image URLs, photo contents, or
          generated collages. Analytics does not use tracking cookies, follow
          you across other sites, or identify you personally.
        </li>
        <li>
          <strong>Standard server logs</strong> — our hosting provider (Vercel)
          processes routine request metadata (such as IP address and browser
          user-agent) for the sole purpose of delivering the web page to you, as
          happens with essentially any website.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">
        What we do <em>not</em> collect
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>Your photos or anything derived from them.</li>
        <li>
          Names, email addresses, or account credentials (there are no
          accounts).
        </li>
        <li>Precise location.</li>
        <li>Cross-site tracking or advertising profiles.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">
        Cookies &amp; local storage
      </h2>
      <p className="mt-3">
        Gallery view preferences (tile shape, size, spacing, fit, labels and sorting)
        are stored locally. Ordinary library files and collage edits are session-only.
        Explicitly saved named bundles retain selected original photos, filenames, order and
        crop settings in local IndexedDB. Original ZIP entries retain embedded metadata;
        optional posting copies are rendered locally.
        Photo Grouper does not use tracking or advertising cookies. As a
        Progressive Web App, it uses a service worker to cache the
        application&apos;s own code and assets so it can work offline — this
        cache contains app files, <strong>not</strong> your photos.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">
        Fonts &amp; third parties
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <strong>Fonts are self-hosted.</strong> The app serves its fonts from
          its own domain and does not make requests to Google Fonts at runtime.
        </li>
        <li>
          The only third party involved in the hosted site is{" "}
          <strong>Vercel</strong>, which provides hosting and the optional
          analytics described above.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">
        Self-hosted and forked versions
      </h2>
      <p className="mt-3">
        Photo Grouper is open source, and anyone can run their own copy. In
        self-hosted or forked deployments, analytics is{" "}
        <strong>disabled by default</strong> and only runs if the operator
        explicitly opts in. If you use a copy hosted by someone else, their data
        practices — not this policy — apply.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">
        Children&apos;s privacy
      </h2>
      <p className="mt-3">
        Photo Grouper does not knowingly collect personal information from
        anyone, including children, because it does not collect personal
        information at all.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">
        Changes to this policy
      </h2>
      <p className="mt-3">
        If this policy changes, the updated version will be posted here with a
        revised effective date.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">Contact</h2>
      <p className="mt-3">
        Questions about privacy? Open an issue on{" "}
        <a
          href="https://github.com/namabeeru/photo-grouper/issues"
          className="text-indigo-600 hover:underline"
        >
          GitHub
        </a>
        .
      </p>
    </main>
  );
}
