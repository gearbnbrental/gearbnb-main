import { RmsApiError } from './rmsApi';

/**
 * The shop (gear for sale) as the website uses it. Built only from GET /api/customer/shop, field by
 * field: every name, price and photo comes from the RMS, and anything the RMS sends that isn't
 * listed here is ignored, so new RMS fields never break the page.
 *
 * The RMS groups identical units into one listing with a `quantity` and a stable `listingKey`, like
 * the rental catalog. An older RMS sent one entry per unit instead: those are grouped here the same
 * way (units the same in every way a camper sees), so the page works with either.
 */
export interface ShopItem {
  /** The listing's id: the RMS's `listingKey` (what a later cart and checkout will name), or, from an
   *  RMS that doesn't send one yet, the first unit's id. Stable when a unit sells. */
  id: string;
  /** How many are for sale right now; always 1 or more. */
  quantity: number;
  /** This listing's address under SHOP_PATH, e.g. "blackdog-starchase-13x". */
  slug: string;
  name: string;
  category: string;
  /** "" for generic gear: no brand is shown. */
  brand: string;
  model: string | null;
  color: string | null;
  /** Already a display label ("Brand new", "Excellent", "Good", "Fair", "Needs repair"). */
  condition: string;
  description: string | null;
  priceCentavos: number;
  /** The price before a sale, shown crossed out. Only kept when it's higher than the price. */
  originalPriceCentavos: number | null;
  /** Full public photo URLs, main photo first: every unit's photos together, each once. May be empty. */
  images: string[];
}

/** One entry from the RMS: a whole listing (with `listingKey` and `quantity`) or, from an older RMS,
 *  a single unit (both null). */
type ShopEntry = Omit<ShopItem, 'quantity' | 'slug'> & { listingKey: string | null; quantity: number | null };

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const optionalText = (value: unknown): string | null => text(value) || null;
const isCentavos = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isPhotoUrl = (src: unknown): src is string => typeof src === 'string' && /^https?:\/\//.test(src);

/** The unit's photos from the RMS, main photo first: `imageUrl` when the RMS sends one (the rental
 *  catalog's main-photo field), then the `images` gallery (best first), each photo once. */
function shopPhotos(main: unknown, gallery: unknown): string[] {
  const photos = [main, ...(Array.isArray(gallery) ? gallery : [])].filter(isPhotoUrl);
  return [...new Set(photos)];
}

/** One RMS entry, or null when it's missing something the shop can't do without (an id or
 *  listing key, a name, a valid price) or has nothing for sale (a quantity below 1 is never shown). */
function toShopEntry(raw: unknown): ShopEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const listingKey = text(item.listingKey) || null;
  const id = listingKey ?? text(item.id);
  const name = text(item.name);
  if (!id || !name || !isCentavos(item.priceCentavos)) return null;
  let quantity: number | null = null;
  if (item.quantity !== undefined) {
    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) return null;
    quantity = item.quantity;
  }
  const original = item.originalPriceCentavos;
  return {
    id,
    listingKey,
    quantity,
    name,
    category: text(item.category) || 'Other',
    brand: text(item.brand),
    model: optionalText(item.model),
    color: optionalText(item.color),
    condition: text(item.condition),
    description: optionalText(item.description),
    priceCentavos: item.priceCentavos,
    originalPriceCentavos: isCentavos(original) && original > item.priceCentavos ? original : null,
    images: shopPhotos(item.imageUrl, item.images),
  };
}

/** Which listing an entry belongs to: the RMS's own listingKey when it sends one; otherwise (one
 *  entry per unit) everything a camper sees, ignoring letter case. */
const groupKey = (unit: ShopEntry) =>
  unit.listingKey ? `listing:${unit.listingKey}` : JSON.stringify([
    unit.name.toLowerCase(),
    unit.category.toLowerCase(),
    unit.brand.toLowerCase(),
    unit.model?.toLowerCase() ?? null,
    unit.color?.toLowerCase() ?? null,
    unit.condition.toLowerCase(),
    unit.priceCentavos,
    unit.originalPriceCentavos,
    unit.description,
  ]);

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const nameSlug = (name: string) => slugify(name) || 'item';
const keyFragment = (id: string, length: number) => id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, length);

/**
 * Gives every listing an address: just its name when no other listing has that name
 * ("blackdog-starchase-13x"), else its name plus the start of its listingKey
 * ("blackdog-starchase-13x-3f9a1c0d"). The key only appears when it's needed, so a listing with a
 * unique name keeps the same clean address whatever happens to its units or key.
 */
function withSlugs(listings: Omit<ShopItem, 'slug'>[]): ShopItem[] {
  const perName = new Map<string, number>();
  for (const listing of listings) perName.set(nameSlug(listing.name), (perName.get(nameSlug(listing.name)) ?? 0) + 1);
  const slugs = listings.map((listing) =>
    perName.get(nameSlug(listing.name)) === 1 ? nameSlug(listing.name) : `${nameSlug(listing.name)}-${keyFragment(listing.id, 8)}`,
  );
  // Two shared-name listings whose keys start the same: the whole key tells them apart.
  return listings.map((listing, index) => ({
    ...listing,
    slug: slugs.indexOf(slugs[index]) === slugs.lastIndexOf(slugs[index]) ? slugs[index] : `${nameSlug(listing.name)}-${keyFragment(listing.id, 64)}`,
  }));
}

/** The `{ items }` body of GET /api/customer/shop as the shop's listings, in the RMS's order (a
 *  listing sits where its first unit was). Unusable entries are dropped rather than failing the
 *  whole list; a body with no `items` array counts as an empty shop. */
export function normalizeShopItems(body: unknown): ShopItem[] {
  const items = body && typeof body === 'object' ? (body as { items?: unknown }).items : undefined;
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const listings = new Map<string, Omit<ShopItem, 'slug'>>();
  for (const raw of items) {
    const entry = toShopEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const { listingKey: _listingKey, quantity, ...fields } = entry;
    const key = groupKey(entry);
    const listing = listings.get(key);
    if (listing) {
      listing.quantity += quantity ?? 1;
      // A photo on any one unit shows for the whole listing.
      listing.images = [...new Set([...listing.images, ...entry.images])];
    } else {
      listings.set(key, { ...fields, quantity: quantity ?? 1 });
    }
  }
  return withSlugs([...listings.values()]);
}

/** The shop's own address; each listing has its own page under it. */
export const SHOP_PATH = '/catalog/camping-gear-sale';

/** "/catalog/camping-gear-sale/blackdog-starchase-13x" */
export const shopItemPath = (item: Pick<ShopItem, 'slug'>) => `${SHOP_PATH}/${item.slug}`;

export function findShopItemBySlug(items: ShopItem[], slug: string | undefined): ShopItem | undefined {
  return slug ? items.find((item) => item.slug === slug) : undefined;
}

/** "2 available", or "Only 1 left". */
export const availableText = (item: Pick<ShopItem, 'quantity'>) => (item.quantity === 1 ? 'Only 1 left' : `${item.quantity} available`);

/** "brand new" / "used, excellent condition" / "needs repair", for sentences. */
export function conditionPhrase(condition: string): string {
  const tone = conditionTone(condition);
  if (tone === 'new') return 'brand new';
  if (tone === 'repair') return 'needs repair';
  return condition ? `used, ${condition.toLowerCase()} condition` : 'used';
}

const PESOS = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 250000 -> "₱2,500.00". */
export function formatShopPrice(centavos: number): string {
  return PESOS.format(centavos / 100);
}

/** "Coleman Sundome", "Coleman", "Sundome" or "" (generic gear with no model). */
export function brandAndModel(item: Pick<ShopItem, 'brand' | 'model'>): string {
  return [item.brand, item.model].filter(Boolean).join(' ');
}

/** The brand and model line under the name, or "" when the name already says it
 *  ("Blackdog Starchase 13x" by Blackdog, model Starchase 13x). */
export function brandAndModelLine(item: Pick<ShopItem, 'name' | 'brand' | 'model'>): string {
  const line = brandAndModel(item);
  return line && item.name.toLowerCase().includes(line.toLowerCase()) ? '' : line;
}

export type ShopSort = 'featured' | 'price-asc' | 'price-desc';

export const SHOP_SORTS: { value: ShopSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

/** Every category in the shop with how many items it has, A to Z. */
export function shopCategories(items: ShopItem[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Items in `category` ("" for all) whose name, brand or model contains every word of `query`. */
export function filterShopItems(items: ShopItem[], { category, query }: { category: string; query: string }): ShopItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (category && item.category !== category) return false;
    const haystack = [item.name, item.brand, item.model ?? ''].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** A sorted copy. "featured" keeps the RMS's own order; equal prices keep it too. */
export function sortShopItems(items: ShopItem[], sort: ShopSort): ShopItem[] {
  if (sort === 'featured') return [...items];
  const direction = sort === 'price-asc' ? 1 : -1;
  return [...items].sort((a, b) => direction * (a.priceCentavos - b.priceCentavos));
}

export interface ShopLoadError {
  message: string;
  /** Set when the RMS asked us to wait (429): Try again stays off until then. */
  retryAfterMs?: number;
}

const GENERIC_SHOP_ERROR = "We couldn't load the shop right now. Please try again in a moment.";
/** How long to wait after a 429 that came without a usable Retry-After. */
const DEFAULT_RATE_LIMIT_WAIT_MS = 30_000;

/** What the error state says for a failed shop load: the RMS's own message on a 503, a wait on a
 *  429 (for as long as Retry-After says), and a plain "try again" for anything else. */
export function describeShopError(err: unknown): ShopLoadError {
  if (err instanceof RmsApiError) {
    if (err.status === 429) {
      const retryAfterMs = err.retryAfterMs ?? DEFAULT_RATE_LIMIT_WAIT_MS;
      const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return { message: `The shop is busy right now. Please try again in ${seconds} second${seconds === 1 ? '' : 's'}.`, retryAfterMs };
    }
    // rmsFetch falls back to this when a 503 came without a message of its own.
    if (err.status === 503 && err.message && err.message !== 'The request could not be completed.') return { message: err.message };
  }
  return { message: GENERIC_SHOP_ERROR };
}

/** How long a loaded shop list is reused before the next page visit fetches it again. */
export const SHOP_CACHE_MS = 60_000;

/**
 * Keeps the last good shop list for `ttlMs`, and shares one request between callers that ask at
 * the same time. Failures are never kept, so Try again always asks the RMS. Nothing here runs on
 * a timer: the list is only fetched when a page asks for it.
 */
export function createShopCache(fetchItems: () => Promise<ShopItem[]>, ttlMs = SHOP_CACHE_MS, now: () => number = Date.now) {
  let cached: { items: ShopItem[]; at: number } | null = null;
  let inFlight: Promise<ShopItem[]> | null = null;

  const fresh = () => (cached && now() - cached.at < ttlMs ? cached.items : null);

  return {
    /** The cached list while it's still fresh, otherwise null. */
    peek: fresh,
    load(): Promise<ShopItem[]> {
      const items = fresh();
      if (items) return Promise.resolve(items);
      if (!inFlight) {
        inFlight = fetchItems()
          .then((loaded) => {
            cached = { items: loaded, at: now() };
            return loaded;
          })
          .finally(() => {
            inFlight = null;
          });
      }
      return inFlight;
    },
  };
}

/** How a condition label is coloured. Unknown labels get the neutral style. */
export function conditionTone(condition: string): 'new' | 'good' | 'fair' | 'repair' | 'neutral' {
  switch (condition.toLowerCase()) {
    case 'brand new':
      return 'new';
    case 'excellent':
    case 'good':
      return 'good';
    case 'fair':
      return 'fair';
    case 'needs repair':
      return 'repair';
    default:
      return 'neutral';
  }
}

/** True when `slug` is `form` itself, or `form` followed by more words ("tent" matches "tent-x1"). */
const startsWithForm = (slug: string, form: string) => slug === form || slug.startsWith(`${form}-`);

/** The more specific address forms used before 2026-11-16 (name + condition + price, then name +
 *  condition), most specific first: still recognised, so old links reach the right listing. */
const olderForms = (item: ShopItem) => [
  slugify(`${item.name} ${item.condition} ${item.priceCentavos / 100}`),
  slugify(`${item.name} ${item.condition}`),
];

export type ShopAddress = { type: 'page'; item: ShopItem } | { type: 'redirect'; to: string } | { type: 'not-found' };

/**
 * Where a shop address should go, for addresses that may be out of date (a listingKey that
 * changed, an older address form). A current address is its page. Otherwise the longest listing
 * name the address starts with decides: one listing with that name gets a 301 to its current
 * address; several get the one whose key fragment, then condition and price, still match, or else the shop list. An
 * address that starts with no current listing's name is a real 404.
 */
export function resolveShopSlug(items: ShopItem[], slug: string): ShopAddress {
  const exact = items.find((item) => item.slug === slug);
  if (exact) return { type: 'page', item: exact };
  const name = [...new Set(items.map((item) => nameSlug(item.name)))]
    .filter((candidate) => startsWithForm(slug, candidate))
    .sort((a, b) => b.length - a.length)[0];
  if (!name) return { type: 'not-found' };
  const sameName = items.filter((item) => nameSlug(item.name) === name);
  if (sameName.length === 1) return { type: 'redirect', to: shopItemPath(sameName[0]) };
  // An older address that still ends with a listing's own key fragment means that listing.
  const byKey = sameName.filter((item) => slug.endsWith(`-${keyFragment(item.id, 8)}`));
  if (byKey.length === 1) return { type: 'redirect', to: shopItemPath(byKey[0]) };
  for (const level of [0, 1]) {
    const hits = sameName.filter((item) => startsWithForm(slug, olderForms(item)[level]));
    if (hits.length === 1) return { type: 'redirect', to: shopItemPath(hits[0]) };
  }
  return { type: 'redirect', to: SHOP_PATH };
}

/** One server redirect: an address that is `slug` itself or `slug` followed by more words (and,
 *  with `key`, ending in "-{key}") goes to `to` with a 301. */
export interface ShopRedirectRule {
  slug: string;
  key?: string;
  to: string;
}

/** Whether an address matches a redirect rule, the way the server's rule does. */
export const matchesShopRedirect = (slug: string, rule: ShopRedirectRule) =>
  startsWithForm(slug, rule.slug) && (!rule.key || slug.endsWith(`-${rule.key}`));

/**
 * The server's 301 rules for out-of-date shop addresses, matching resolveShopSlug exactly. They
 * are checked after every current page's own rule (a current address is never redirected), in
 * this order: longest listing name first; within a name, key fragment, then the older forms, then
 * the name itself.
 */
export function shopRedirectRules(items: ShopItem[]): ShopRedirectRule[] {
  const groups: { name: string; rules: ShopRedirectRule[] }[] = [];
  const names = new Set(items.map((item) => nameSlug(item.name)));
  for (const name of names) {
    const rules: ShopRedirectRule[] = [];
    groups.push({ name, rules });
    const sameName = items.filter((item) => nameSlug(item.name) === name);
    if (sameName.length === 1) {
      rules.push({ slug: name, to: shopItemPath(sameName[0]) });
      continue;
    }
    for (const item of sameName) {
      const key = keyFragment(item.id, 8);
      if (sameName.filter((other) => keyFragment(other.id, 8) === key).length === 1) rules.push({ slug: name, key, to: shopItemPath(item) });
    }
    for (const level of [0, 1]) {
      for (const item of sameName) {
        const form = olderForms(item)[level];
        // Only a form that points at exactly one listing (and that a more specific form hasn't
        // already settled) becomes a rule; the rest fall through to the shop list.
        // A form that starts with a longer listing name belongs to that name instead (as in
        // resolveShopSlug, the longest name wins).
        const ownedByLongerName = [...names].some((other) => other.length > name.length && startsWithForm(form, other));
        const unique = sameName.filter((other) => olderForms(other)[level] === form).length === 1;
        if (unique && !ownedByLongerName && !rules.some((rule) => rule.slug === form)) {
          rules.push({ slug: form, to: shopItemPath(item) });
        }
      }
    }
    rules.push({ slug: name, to: SHOP_PATH });
  }
  return groups.sort((a, b) => b.name.length - a.name.length).flatMap((group) => group.rules);
}

