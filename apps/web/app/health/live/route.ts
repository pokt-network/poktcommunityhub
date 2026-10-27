/**
 * Liveness: the process is up and serving requests. Deliberately checks nothing
 * else, so a database outage marks the app not-ready rather than having Docker
 * restart a healthy process in a loop.
 */
export function GET() {
  return Response.json(
    { status: 'live', commit: process.env['APP_COMMIT'] ?? 'unknown' },
    { headers: { 'cache-control': 'no-store' } },
  );
}
