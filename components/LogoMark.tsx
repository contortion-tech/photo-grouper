/**
 * PhotoGrouper logo mark — Mosaic.
 *
 * Drop-in React component. Pass `size` to scale; the SVG keeps its
 * intrinsic aspect ratio via viewBox. Two variants: 'light' (default,
 * for white / off-white backgrounds) and 'dark' (slightly brighter
 * palette for dark surfaces).
 *
 * Usage:
 *   import LogoMark from "@/components/LogoMark";
 *   <LogoMark size={48} />
 *   <LogoMark size={48} variant="dark" />
 */

import React from "react";

interface LogoMarkProps {
  size?: number;
  variant?: "light" | "dark";
  title?: string;
  className?: string;
}

export default function LogoMark({
  size = 40,
  variant = "light",
  title = "PhotoGrouper",
  className,
}: LogoMarkProps) {
  const gradId = React.useId();

  // Tile palette — kept identical structure in both variants so the
  // shapes don't shift; only the fills change.
  const palette =
    variant === "dark"
      ? {
          gradFrom: "#818CF8",
          gradTo: "#6366F1",
          bottomLeft: "#C4B5FD",
          bottomRight: "#E0E7FF",
          lifted: "#A78BFA",
          dot: "#FFFFFF",
          dotOpacity: 0.85,
        }
      : {
          gradFrom: "#6366F1",
          gradTo: "#4338CA",
          bottomLeft: "#A78BFA",
          bottomRight: "#C7D2FE",
          lifted: "#8B5CF6",
          dot: "#FFFFFF",
          dotOpacity: 0.7,
        };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.gradFrom} />
          <stop offset="1" stopColor={palette.gradTo} />
        </linearGradient>
      </defs>
      {/* top-left */}
      <rect x="34" y="34" width="60" height="60" rx="12" fill={`url(#${gradId})`} />
      {/* bottom-left */}
      <rect x="34" y="106" width="60" height="60" rx="12" fill={palette.bottomLeft} />
      {/* bottom-right */}
      <rect x="106" y="106" width="60" height="60" rx="12" fill={palette.bottomRight} />
      {/* top-right — lifted + rotated */}
      <g transform="translate(136 60) rotate(8) translate(-30 -30)">
        <rect width="60" height="60" rx="12" fill={palette.lifted} />
        <circle cx="20" cy="20" r="5" fill={palette.dot} opacity={palette.dotOpacity} />
      </g>
    </svg>
  );
}
