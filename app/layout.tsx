import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/utils/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Analytics is opt-in: off by default so self-hosted and forked deployments
// don't emit analytics. The official deployment sets
// NEXT_PUBLIC_ENABLE_ANALYTICS=true.
const analyticsEnabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true";

export const viewport: Viewport = {
  themeColor: "#1E1B4B",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Photo Grouper — Free Private Photo Collage Maker (No Upload)",
    template: "%s — Photo Grouper",
  },
  description:
    "Create beautiful photo collages with privacy-first design. Your photos stay on your device — zero cloud uploads, ever. Free, no account, works offline.",
  applicationName: "Photo Grouper",
  manifest: "/site.webmanifest",
  keywords: [
    "photo collage",
    "collage maker",
    "free collage maker",
    "private collage maker",
    "no upload collage maker",
    "offline collage maker",
    "photo grouper",
    "privacy",
    "photo editor",
  ],
  authors: [{ name: "Photo Grouper" }],
  creator: "Photo Grouper",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Photo Grouper",
    title: "Photo Grouper — Create Beautiful Photo Collages, Privately",
    description:
      "Create stunning photo collages with complete privacy. Your photos never leave your device. Free, no account, works offline.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Photo Grouper - Privacy-first photo collage maker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Photo Grouper — Create Beautiful Photo Collages, Privately",
    description:
      "Create stunning photo collages with complete privacy. Your photos never leave your device.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Photo Grouper",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Photo Grouper",
  url: SITE_URL,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any (web browser)",
  description:
    "A privacy-first, offline-capable photo collage maker. All photos are processed in your browser and never uploaded.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  isAccessibleForFree: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {analyticsEnabled && <Analytics />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
