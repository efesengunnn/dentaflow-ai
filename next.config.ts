import type { NextConfig } from "next";

// CSP is deliberately not included here — it needs per-resource allowlisting
// (Supabase URL, font/script origins) verified against a real browser session
// before shipping, not a config-only guess. These five are safe, standard
// defaults that don't require app-specific tuning.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
