/** Dicebear SVGs break next/image unless dangerouslyAllowSVG is on; prefer PNG. */
export function normalizeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(
    /api\.dicebear\.com\/([^/]+)\/([^/?]+)\/svg/i,
    "api.dicebear.com/$1/$2/png",
  );
}
