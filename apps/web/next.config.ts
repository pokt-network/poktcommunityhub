import path from 'node:path';
import type { NextConfig } from 'next';

// The pnpm workspace root. Turbopack and the standalone tracer cannot infer it in a
// monorepo; without it the trace stops at apps/web and the workspace packages are
// silently missing from the image.
const workspaceRoot = path.join(__dirname, '..', '..');

/**
 * Security headers on every response. The Content-Security-Policy arrives with
 * sign-in in phase 3, when the set of origins the page talks to is known; a CSP
 * written before then would be a guess, and a wrong CSP is either broken or open.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  // The deployed artifact: only the files the server reaches, under .next/standalone.
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  poweredByHeader: false,
  // The image's commit, so a stale tab reloads instead of mixing two builds' assets.
  ...(process.env['GIT_COMMIT'] ? { deploymentId: process.env['GIT_COMMIT'] } : {}),
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
