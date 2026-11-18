/**
 * The AI camp guide's cart link: `/cart?ai=1&start=YYYY-MM-DD&duration=48|72&items=<type>:<id>:<qty>,...`
 *
 * The camp guide sends this after checking that the gear is free, but the site treats it as a suggestion from an
 * untrusted address: every value is validated, every id is looked up in the live catalog (anything the catalog doesn't
 * list is left out), and the link only FILLS the cart. Verification, the deposit and staff review all still happen as
 * usual, and the link's contents go nowhere except the cart.
 *
 * Ids come from the RMS catalog API: `package:<packageNumber>` (matched case-insensitively) and `item:<id>`, where the
 * id is a gear kind's `id` or, for a gear kind sold in several colours, one colour's `variants[].id` (which also picks
 * that colour). They are never built or guessed here.
 */
import { z } from 'zod';
import { byoGearKey, byoLineKeyOf, checkKitAvailability, getGearKindPrice, getKitPrice } from '../context/RentalContext';
import type { BookableGearKind, CartState, PackageKit, TripDetails } from '../types/gearbnb';
import { getDurationRange, latestBookableDateISO } from './duration';
import { resolveGearVariant } from './gearVariants';
import { kitForEdition } from './kitEdition';
import type { CartEntryKind } from './metaTracking';

const LINK_PARAMS = ['ai', 'start', 'duration', 'items'] as const;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_LINES = 12;
const MAX_QUANTITY = 20;

export interface CartLinkLine {
  type: 'package' | 'item';
  id: string;
  quantity: number;
}

export interface CartLink {
  startDate: string;
  duration: '48' | '72';
  lines: CartLinkLine[];
}

export type CartLinkParseResult = { status: 'absent' } | { status: 'invalid' } | { status: 'valid'; link: CartLink };

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const lineSchema = z.tuple([
  z.enum(['package', 'item']),
  z.string().regex(ID_PATTERN),
  z
    .string()
    .regex(/^\d{1,3}$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(MAX_QUANTITY)),
]);

function linkSchema(todayISO: string) {
  return z
    .object({
      ai: z.literal('1'),
      start: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine(isRealDate)
        // Today (Manila) or later, and no further ahead than the site's own date pickers allow.
        .refine((start) => start >= todayISO && start <= latestBookableDateISO(todayISO)),
      duration: z.enum(['48', '72']),
      items: z
        .string()
        .max(2000)
        .transform((value) => value.split(',').map((entry) => entry.split(':')))
        .pipe(z.array(lineSchema).min(1).max(MAX_LINES)),
    })
    .superRefine((value, ctx) => {
      const packages = value.items.filter(([type]) => type === 'package');
      // The site books one package at a time.
      if (packages.length > 1 || packages.some(([, , quantity]) => quantity !== 1)) {
        ctx.addIssue({ code: 'custom', message: 'at most one package, quantity 1' });
      }
      const ids = value.items.map(([type, id]) => `${type}:${id.toLowerCase()}`);
      if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'duplicate line' });
    });
}

/**
 * Reads the link from a query string. `absent` when this isn't an AI cart link at all (no `ai` parameter); `invalid`
 * when it is one but anything about it is wrong, in which case none of it is used.
 */
export function parseCartLink(search: string | URLSearchParams, todayISO: string): CartLinkParseResult {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  if (!params.has('ai')) return { status: 'absent' };

  const raw: Record<string, string | undefined> = {};
  for (const name of LINK_PARAMS) {
    // A repeated parameter is ambiguous, so the link is refused rather than guessed at.
    if (params.getAll(name).length > 1) return { status: 'invalid' };
    raw[name] = params.get(name) ?? undefined;
  }

  const parsed = linkSchema(todayISO).safeParse(raw);
  if (!parsed.success) return { status: 'invalid' };
  return {
    status: 'valid',
    link: {
      startDate: parsed.data.start,
      duration: parsed.data.duration,
      lines: parsed.data.items.map(([type, id, quantity]) => ({ type, id, quantity })),
    },
  };
}

/** The query string with the link's own parameters removed (anything else, such as an ad click id, is kept). */
export function withoutCartLinkParams(search: string): string {
  const params = new URLSearchParams(search);
  for (const name of LINK_PARAMS) params.delete(name);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

/** What the link adds once every id has been looked up in the live catalog. */
export interface CartLinkPlan {
  startDate: string;
  returnDate: string;
  /** The package (one colour of it, when it comes in several), or null. */
  kit: PackageKit | null;
  /** Gear to add: as extras on the package when there is one, otherwise as Build Your Own lines. */
  gears: { gear: BookableGearKind; quantity: number }[];
  /** How many lines of the link were left out (not in the catalog, or out of stock). */
  skipped: number;
}

function findKit(kits: readonly PackageKit[], packageNumber: string): PackageKit | null {
  const wanted = packageNumber.toLowerCase();
  for (const kit of kits) {
    if (kit.editions && kit.editions.length > 0) {
      const edition = kit.editions.find((e) => e.packageNumber.toLowerCase() === wanted);
      if (edition) return kitForEdition(kit, edition);
    } else if (kit.packageNumber.toLowerCase() === wanted) {
      return kit;
    }
  }
  return null;
}

/** Gear by AI catalog id: a single-colour kind by its own id, a multi-colour kind by each colour's id (resolved to that colour). */
function gearById(gearKinds: readonly BookableGearKind[]): Map<string, BookableGearKind> {
  const byId = new Map<string, BookableGearKind>();
  for (const kind of gearKinds) {
    if (kind.variants && kind.variants.length > 0) {
      for (const variant of kind.variants) {
        if (variant.catalogId) byId.set(variant.catalogId.toLowerCase(), resolveGearVariant(kind, variant.color));
      }
    } else if (kind.catalogId) {
      byId.set(kind.catalogId.toLowerCase(), kind);
    }
  }
  return byId;
}

export function resolveCartLink(link: CartLink, kits: readonly PackageKit[], gearKinds: readonly BookableGearKind[]): CartLinkPlan {
  const { startDate, returnDate } = getDurationRange(link.duration === '48' ? '48h' : '72h', link.startDate);
  const gearLookup = gearById(gearKinds);
  let skipped = 0;
  let kit: PackageKit | null = null;
  const gears: CartLinkPlan['gears'] = [];

  for (const line of link.lines) {
    if (line.type === 'package') {
      const found = findKit(kits, line.id);
      // Same rule as the package catalog's Book Now: an out-of-stock package can't be added.
      if (found && checkKitAvailability(found, null)) kit = found;
      else skipped += 1;
      continue;
    }
    const gear = gearLookup.get(line.id.toLowerCase());
    if (!gear || gear.quantity <= 0) {
      skipped += 1;
      continue;
    }
    // Never more than the units that exist. Whether they are free on the trip dates is the normal availability check's
    // job, which still runs (and says so) on the cart and at checkout.
    gears.push({ gear, quantity: Math.min(line.quantity, gear.quantity) });
  }

  return { startDate, returnDate, kit, gears, skipped };
}

export function cartLinkAddsAnything(plan: CartLinkPlan): boolean {
  return plan.kit !== null || plan.gears.length > 0;
}

/** The rental fee of what the link adds, in pesos (the deposit isn't part of it), priced exactly as the cart prices it. */
export function cartLinkValue(plan: CartLinkPlan, tripDetails: TripDetails): number {
  const trip = { ...tripDetails, startDate: plan.startDate, returnDate: plan.returnDate };
  const kitFee = plan.kit ? getKitPrice(plan.kit, trip) : 0;
  return kitFee + plan.gears.reduce((sum, { gear, quantity }) => sum + getGearKindPrice(gear, trip) * quantity, 0);
}

export const INVALID_LINK_NOTICE = 'That cart link was not valid. You can still build your cart here.';
export const CATALOG_UNAVAILABLE_NOTICE = "We couldn't load our gear list to fill your cart. Please open the link again in a moment.";

export function skippedLinesNotice(skipped: number): string | null {
  if (skipped <= 0) return null;
  return skipped === 1
    ? '1 item from the link is no longer available and was left out.'
    : `${skipped} items from the link are no longer available and were left out.`;
}

/** What the catalog looks like right now, as the cart page sees it. */
export interface CartLinkCatalog {
  authReady: boolean;
  packagesState: 'loading' | 'ready' | 'error';
  kits: readonly PackageKit[];
  gearState: 'loading' | 'ready' | 'error';
  gearKinds: readonly BookableGearKind[] | null;
  tripDetails: TripDetails;
}

export interface CartLinkEffects {
  apply: (plan: CartLinkPlan) => void;
  notify: (notice: string) => void;
  /** Removes the link's parameters from the address, so a reload doesn't add it all again. */
  clearLink: () => void;
  track: (kind: CartEntryKind, valuePesos: number) => void;
}

/**
 * Handles each link once: the cart page calls `run` on every render that might matter (the address or the catalog
 * changed), and only the first run that has everything it needs does anything. That is what keeps the Pixel's
 * AddToCart to one event per link, whatever React re-renders.
 */
export function createCartLinkRunner(effects: CartLinkEffects, today: () => string) {
  const handled = new Set<string>();
  return {
    run(search: string, catalog: CartLinkCatalog): void {
      const parsed = parseCartLink(search, today());
      if (parsed.status === 'absent' || handled.has(search)) return;

      if (parsed.status === 'invalid') {
        handled.add(search);
        effects.clearLink();
        effects.notify(INVALID_LINK_NOTICE);
        return;
      }

      const needsPackages = parsed.link.lines.some((line) => line.type === 'package');
      const needsGear = parsed.link.lines.some((line) => line.type === 'item');
      // Wait for sign-in to settle (a cart filled into the guest cart and then swapped for the account's would be lost)
      // and for the catalogs the link needs.
      if (!catalog.authReady) return;
      if ((needsPackages && catalog.packagesState === 'loading') || (needsGear && catalog.gearState === 'loading')) return;

      handled.add(search);
      // A catalog that failed to load says nothing about whether the link's gear exists, so nothing is added and the
      // link is left in the address: opening it again tries again.
      if ((needsPackages && catalog.packagesState === 'error') || (needsGear && (catalog.gearState === 'error' || !catalog.gearKinds))) {
        effects.notify(CATALOG_UNAVAILABLE_NOTICE);
        return;
      }

      const plan = resolveCartLink(parsed.link, catalog.kits, catalog.gearKinds ?? []);
      effects.clearLink();
      const skippedNotice = skippedLinesNotice(plan.skipped);
      if (skippedNotice) effects.notify(skippedNotice);
      if (!cartLinkAddsAnything(plan)) return;

      effects.apply(plan);
      effects.track(plan.kit ? 'package' : 'build_your_own', cartLinkValue(plan, catalog.tripDetails));
    },
  };
}

/**
 * What is in the cart (entries and quantities only, not dates being browsed or what is ticked for checkout), so the
 * cart page can tell when the camper has changed what the AI camp guide prepared and stop showing its banner.
 */
export function cartEntriesSignature(cart: CartState): string {
  const sorted = (values: string[]) => [...values].sort().join(',');
  return JSON.stringify([
    sorted(cart.selectedKits.map((kit) => kit.id)),
    sorted(cart.selectedItems.map((item) => item.id)),
    sorted(Object.entries(cart.kitExtras).map(([kitId, ids]) => `${kitId}:${sorted(ids)}`)),
    sorted(Object.entries(cart.itemExtras).map(([itemId, ids]) => `${itemId}:${sorted(ids)}`)),
    sorted(
      Object.entries(cart.packageAddOns).flatMap(([kitId, gears]) => gears.map((gear) => `${kitId}:${byoGearKey(gear)}x${gear.quantity}`)),
    ),
    sorted(cart.byoGears.map((gear) => `${byoLineKeyOf(gear)}x${gear.quantity}`)),
    sorted(
      Object.entries(cart.byoAddOns).flatMap(([lineKey, addOns]) => addOns.map((addOn) => `${lineKey}:${byoGearKey(addOn)}x${addOn.quantity}`)),
    ),
  ]);
}
