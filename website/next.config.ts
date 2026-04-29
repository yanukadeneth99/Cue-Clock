import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent MIME-type sniffing attacks
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Prevent the page from being embedded in a frame (clickjacking)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Force HTTPS for 2 years, include subdomains, allow preload list submission
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Limit referrer data sent to cross-origin destinations
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features not used by this site
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      // Default: only same-origin resources
      "default-src 'self'",
      // Next.js injects inline scripts for hydration; unsafe-inline is required
      "script-src 'self' 'unsafe-inline'",
      // Tailwind uses inline styles; Google Fonts stylesheet is cross-origin
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Google Fonts font files
      "font-src 'self' https://fonts.gstatic.com",
      // Local images and GitHub contributor avatars
      "img-src 'self' data: blob: https://avatars.githubusercontent.com",
      // GitHub API calls for contributors and repo stats
      "connect-src 'self' https://api.github.com",
      // Never allow this page to be framed by any origin
      "frame-ancestors 'none'",
      // Prevent base tag injection
      "base-uri 'self'",
      // Restrict form submissions to same origin
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
