const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.mapbox.com https://api.mapbox.com https://nominatim.openstreetmap.org https://tiles.openfreemap.org https://*.sentry.io https://*.ingest.sentry.io",
  "worker-src 'self' blob:",
  "frame-src 'self' https://accounts.google.com",
  "manifest-src 'self'",
].join("; ");

export const APPLICATION_SECURITY_HEADERS = [
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=()",
  },
] as const;

export function getApplicationSecurityHeaders(isProduction: boolean) {
  return isProduction
    ? [
        ...APPLICATION_SECURITY_HEADERS,
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : [...APPLICATION_SECURITY_HEADERS];
}
