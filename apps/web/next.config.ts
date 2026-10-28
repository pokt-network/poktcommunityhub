import path from 'node:path';
import type { NextConfig } from 'next';

// The pnpm workspace root. Turbopack and the standalone tracer cannot infer it in a
// monorepo; without it the trace stops at apps/web and the workspace packages are
// silently missing from the image.
const workspaceRoot = path.join(__dirname, '..', '..');

const dev = process.env['NODE_ENV'] === 'development';

/**
 * Content-Security-Policy. The page talks to itself, shows Discord avatars, and
 * posts the sign-in form to Discord (form-action covers the redirect a signed-out
 * submit takes before hydration).
 *
 * Scripts allow 'unsafe-inline' because Next's App Router inlines its own
 * bootstrap scripts; the strict alternative is a per-request nonce, which makes
 * every page dynamic. Everything else is locked down, so an injected script
 * still cannot load code from, or send data to, another origin.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://cdn.discordapp.com",
  "font-src 'self'",
  `connect-src 'self'${dev ? ' ws:' : ''}`,
  "form-action 'self' https://discord.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(dev ? [] : ['upgrade-insecure-requests']),
].join('; ');

/** Security headers on every response. */
const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
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
