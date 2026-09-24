/**
 * Matches a leading "Best for ..." / "Best For: ..." / "Best to ..." line — the convention staff use to give a
 * package or a Build Your Own gear kind a short audience tagline (e.g. "Best for Motocampers,
 * Backpackers, Couples or Camping Buddies.") without needing a new RMS field: it's just the FIRST
 * LINE of that item's own description, typed on its own line, with the rest of the real
 * description starting on the next line. This never fabricates a tagline — a description with no
 * such first line simply has none.
 */
const BEST_FOR_PREFIX_RE = /^best (for|to):?\s*/i;

export interface DescriptionWithBestFor {
  /** The word after "Best" as staff wrote it — callers render `Best ${lead} ${bestFor}`. */
  lead: 'for' | 'to';
  /** null when the description has no leading "Best for" line. */
  bestFor: string | null;
  /** The description with that line removed — identical to the input when there was none. */
  rest: string;
}

export function splitBestForLine(description: string): DescriptionWithBestFor {
  const trimmed = description.trim();
  const newlineIndex = trimmed.indexOf('\n');
  const firstLine = newlineIndex === -1 ? trimmed : trimmed.slice(0, newlineIndex);
  if (!BEST_FOR_PREFIX_RE.test(firstLine)) {
    return { lead: 'for', bestFor: null, rest: trimmed };
  }
  const lead = firstLine.match(BEST_FOR_PREFIX_RE)?.[1].toLowerCase() === 'to' ? 'to' : 'for';
  const bestFor = firstLine.replace(BEST_FOR_PREFIX_RE, '').trim();
  const rest = newlineIndex === -1 ? '' : trimmed.slice(newlineIndex + 1).trim();
  return { lead, bestFor: bestFor || null, rest };
}
