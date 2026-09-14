import type { PackageKit } from '../types/gearbnb';

export interface PackageContentItem {
  quantity: number;
  name: string;
}

/** Matches a leading quantity marker like "1x", "2 x", "3×" — the one structural signal these
 * strings reliably carry, both in PackageKit.includedItems entries (mock data — see mockData.ts,
 * e.g. "1x 20cm Inflatable King-Sized Bed") and inside a real Package row's free-text description
 * (see parsePackageContentsFromText below). */
const LEADING_QUANTITY_RE = /^(\d+)\s*[x×]\s*/i;

/** Splits ONE already-known item string into its quantity and name — quantity defaults to 1 when
 * there's no explicit leading marker (e.g. "4-Person Blackdog Vinyl Tent (incl. groundsheet)"),
 * so every row still has a real quantity to display consistently rather than a blank column. */
export function parseQuantityPrefix(itemText: string): PackageContentItem {
  const match = itemText.match(LEADING_QUANTITY_RE);
  if (match) {
    return { quantity: Number(match[1]), name: itemText.slice(match[0].length).trim() };
  }
  return { quantity: 1, name: itemText.trim() };
}

/** Same quantity marker, but found anywhere in a paragraph — used to split a single free-text
 * paragraph into repeated "<qty>x <name>" segments (see parsePackageContentsFromText). */
const QUANTITY_MARKER_RE = /(\d+)\s*[x×]\s*/gi;

/**
 * Best-effort parse of a package's plain-text description into individual inclusion rows —
 * presentation only, never touches the underlying data. The real `packages` table has no
 * structured inclusions column yet (see supabaseCatalog.ts), so on live data the full item list
 * sometimes ends up typed as one continuous description string, e.g. "1x 4 Person Blackdog Vinyl
 * Tent 1x Groundsheet 1x Camping Fan ...". This looks for that specific, reliable shape — two or
 * more repeated "<number>x " markers — and only then treats the text as a list; anything that
 * doesn't match (an ordinary one-off marketing description, which normally contains at most one
 * incidental number) is left completely alone and returned as an empty array, so it renders as
 * plain prose exactly as before. This never fabricates content: every returned item's name is a
 * verbatim slice of the original string, just split at the markers already present in it.
 */
export function parsePackageContentsFromText(text: string): PackageContentItem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const matches = [...trimmed.matchAll(QUANTITY_MARKER_RE)];
  if (matches.length < 2) return [];

  const items: PackageContentItem[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const quantity = Number(match[1]);
    // matchAll always populates `index` for every match — the `| undefined` in RegExpMatchArray's
    // type only accounts for String.prototype.match's non-global-flag case, never this one.
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : trimmed.length;
    const name = trimmed.slice(start, end).trim();
    if (name && Number.isFinite(quantity) && quantity > 0) {
      items.push({ quantity, name });
    }
  }
  return items;
}

/**
 * The single place that decides what a package's "what's included" section should show, reused
 * everywhere a package is rendered (package cards, the homepage bundle preview) so this logic
 * never has to be duplicated or drift between call sites. Prefers the catalog's own structured
 * `includedItems` array when the catalog actually provides one (currently: mock data only); only
 * falls back to parsing `description` when that array is empty AND the description reliably looks
 * like an inclusions list (see parsePackageContentsFromText) rather than ordinary prose.
 */
export function getPackageContentItems(kit: Pick<PackageKit, 'includedItems' | 'description'>): PackageContentItem[] {
  if (kit.includedItems.length > 0) {
    return kit.includedItems.map(parseQuantityPrefix);
  }
  return parsePackageContentsFromText(kit.description);
}

/** Coarse category buckets, checked in this priority order — matches the client's own reference
 * wording ("Tent | Sleeping | Camping Essentials"). Only a label, never new inventory; every item
 * that reaches this still comes straight from getPackageContentItems, i.e. the kit's own real
 * includedItems/description. */
const CATEGORY_RULES: { label: string; pattern: RegExp }[] = [
  { label: 'Tent', pattern: /\btents?\b/i },
  { label: 'Sleeping', pattern: /\b(bed|beds|pillow|pillows|bedsheet|sleeping)\b/i },
  { label: 'Seating', pattern: /\bchairs?\b/i },
];

const CATCH_ALL_CATEGORY = 'Camping Essentials';
const MAX_CATEGORY_SEGMENTS = 3;

/**
 * Summarizes a package's real inclusions into a compact "Tent | Sleeping | Camping Essentials"
 * style line for space-constrained cards (the homepage bundle grid) — a presentation-only
 * grouping of the exact item names getPackageContentItems already returns, never a fabricated or
 * separately-sourced category. Anything that isn't specifically a tent/sleeping/seating item
 * (fans, tables, hammers, groundsheets, lanterns, etc.) folds into the shared "Camping Essentials"
 * catch-all rather than being dropped or invented as its own label.
 */
export function summarizeIncludedCategories(kit: Pick<PackageKit, 'includedItems' | 'description'>): string[] {
  const items = getPackageContentItems(kit);
  if (items.length === 0) return [];

  const found = new Set<string>();
  let hasOther = false;
  for (const item of items) {
    const rule = CATEGORY_RULES.find((r) => r.pattern.test(item.name));
    if (rule) found.add(rule.label);
    else hasOther = true;
  }
  if (hasOther) found.add(CATCH_ALL_CATEGORY);

  const priorityOrder = [...CATEGORY_RULES.map((r) => r.label), CATCH_ALL_CATEGORY];
  return priorityOrder.filter((label) => found.has(label)).slice(0, MAX_CATEGORY_SEGMENTS);
}
