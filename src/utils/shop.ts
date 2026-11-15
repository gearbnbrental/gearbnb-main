import { RmsApiError } from './rmsApi';

/**
 * The shop (gear for sale) as the website uses it. Built only from GET /api/customer/shop, field by
 * field: every name, price and photo comes from the RMS, and anything the RMS sends that isn't
 * listed here is ignored, so new RMS fields never break the page.
 */
export interface ShopItem {
  id: string;
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
  /** Full public photo URLs, best first. May be empty. */
  images: string[];
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const optionalText = (value: unknown): string | null => text(value) || null;
const isCentavos = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** One RMS item as a ShopItem, or null when it's missing something the shop can't do without
 *  (an id, a name or a valid price). */
function toShopItem(raw: unknown): ShopItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = text(item.id);
  const name = text(item.name);
  if (!id || !name || !isCentavos(item.priceCentavos)) return null;
  const original = item.originalPriceCentavos;
  return {
    id,
    name,
    category: text(item.category) || 'Other',
    brand: text(item.brand),
    model: optionalText(item.model),
    color: optionalText(item.color),
    condition: text(item.condition),
    description: optionalText(item.description),
    priceCentavos: item.priceCentavos,
    originalPriceCentavos: isCentavos(original) && original > item.priceCentavos ? original : null,
    images: Array.isArray(item.images) ? item.images.filter((src): src is string => typeof src === 'string' && /^https?:\/\//.test(src)) : [],
  };
}

/** The `{ items }` body of GET /api/customer/shop as ShopItems. Unusable entries are dropped
 *  rather than failing the whole list; a body with no `items` array counts as an empty shop. */
export function normalizeShopItems(body: unknown): ShopItem[] {
  const items = body && typeof body === 'object' ? (body as { items?: unknown }).items : undefined;
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items.flatMap((raw) => {
    const item = toShopItem(raw);
    if (!item || seen.has(item.id)) return [];
    seen.add(item.id);
    return [item];
  });
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
