/**
 * Canonical site URL, shared by metadata, robots, and the sitemap.
 *
 * In production set NEXT_PUBLIC_SITE_URL (e.g. https://photogrouper.com) so the
 * canonical/OG URLs use the custom domain rather than the *.vercel.app host.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");
