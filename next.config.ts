import type { NextConfig } from "next";
import { execFileSync } from "child_process";
import withPWAInit from "@ducanh2912/next-pwa";

// MJ-104: build provenance for the in-app version ticker. Null when git is
// unavailable so the ticker degrades to version-only.
function git(args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", process.cwd(), ...args], { timeout: 5000 }).toString().trim();
  } catch {
    return null;
  }
}

const NEXT_BUILD_GIT_SHA = git(["rev-parse", "--short", "HEAD"]);
const NEXT_BUILD_NUMBER = git(["rev-list", "--count", "HEAD"]);

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    skipWaiting: true,
  },
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {},
  env: {
    NEXT_BUILD_GIT_SHA,
    NEXT_BUILD_NUMBER,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data:",
              "worker-src 'self' blob:",
              "connect-src 'self' blob: http://127.0.0.1:* http://localhost:*",
              "font-src 'self' data:",
              "manifest-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
