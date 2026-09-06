import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: process.cwd()
  },
  // --- MED-09: Content Security Policy and security headers ---
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: http://localhost:* https://localhost:* https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://unpkg.com",
              "font-src 'self' data:",
              "connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://localhost:*",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          }
        ]
      }
    ];
  }
};

const sentryEnabled = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
    silent: true
  })
  : nextConfig;
