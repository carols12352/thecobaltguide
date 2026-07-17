import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { getApplicationSecurityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.0.20"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getApplicationSecurityHeaders(
          process.env.NODE_ENV === "production",
        ),
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
