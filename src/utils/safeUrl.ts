/**
 * Links typed into the RMS (a campsite's Facebook page, website or Google Maps link) only become
 * buttons when they are real web addresses. Anything else (a typo, or a `javascript:` link) is
 * treated as missing.
 */
export function safeWebUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
