import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {
  BookableAddOn,
  BookableAddOnSelection,
  BookableGearKind,
  BookableGearSelection,
  CartState,
  CheckoutSelection,
  DateRange,
  IndividualItem,
  PackageKit,
  TripDetails,
  VerificationDocs,
  VerificationDocumentKey,
} from '../types/gearbnb';
import { useCatalog } from './useCatalog';
import { useAuth } from './AuthContext';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const initialTripDetails: TripDetails = {
  startDate: '',
  returnDate: '',
  fulfillmentType: 'pickup',
  deliveryAddress: '',
  preferredTime: '',
  destination: '',
};

const initialVerificationDocs: VerificationDocs = {
  fullName: '',
  phone: '',
  email: '',
  documents: {
    idType1: null,
    idType2: null,
    verificationVideo: null,
    proofOfBilling: null,
  },
  termsAccepted: false,
  byoAgreementAccepted: false,
  confirmed: false,
};

const initialCheckoutSelection: CheckoutSelection = {
  kitIds: [],
  itemIds: [],
  byoGearKeys: [],
  packageAddOnKeys: {},
  byoAddOnKeys: {},
};

const initialCartState: CartState = {
  selectedKits: [],
  kitExtras: {},
  packageAddOns: {},
  selectedItems: [],
  itemExtras: {},
  byoGears: [],
  byoAddOns: {},
  tripDetails: initialTripDetails,
  verificationDocs: initialVerificationDocs,
  checkoutSelection: initialCheckoutSelection,
  removedItemNames: [],
};

/** Identifies a Build Your Own gear kind (or add-on) the same way the RMS does — there is no
 * client-side id, only this category+brand+model triple. Used both as the React list key and as
 * the key into `byoAddOns`. */
export function byoGearKey(gear: { category: string; brand: string; model: string | null }): string {
  return `${gear.category}|${gear.brand}|${gear.model ?? ''}`;
}

/** Guest (not-logged-in) cart storage key — unchanged from before this file supported per-account
 *  carts, so an in-progress guest cart already on a customer's browser keeps working exactly as
 *  it did. */
const GUEST_CART_STORAGE_KEY = 'gearbnb.cart.v1';

/** One authenticated customer's own cart, isolated from every other account (and from the guest
 *  cart) on the same browser — the actual fix for a cart "belonging" to the wrong signed-in user.
 *  Keyed by the verified Supabase auth user id, never anything client-chosen. */
function userCartStorageKey(authUserId: string): string {
  return `gearbnb.cart.v1.user.${authUserId}`;
}

/**
 * The slices of the cart that survive a reload. Verification state is mostly deliberately
 * excluded: the browser File objects behind an upload can't be serialised, and persisting slot
 * metadata without them would let the submission gate pass on files the page no longer holds —
 * see loadPersistedCart's own per-user branch, which still starts `documents`/`confirmed`/the
 * agreement checkboxes empty. The one exception is `verificationContact`: plain text the customer
 * already typed (never a file, a token, or anything sensitive), persisted so it isn't lost to a
 * refresh or an accidental nav-away — the actual "verification DETAILS shouldn't disappear" ask,
 * without touching the file-upload gate's correctness at all.
 */
interface PersistedCart {
  selectedKits: PackageKit[];
  kitExtras: Record<string, string[]>;
  packageAddOns: Record<string, BookableGearSelection[]>;
  selectedItems: IndividualItem[];
  itemExtras: Record<string, string[]>;
  byoGears: BookableGearSelection[];
  byoAddOns: Record<string, BookableAddOnSelection[]>;
  tripDetails: TripDetails;
  verificationContact: Pick<VerificationDocs, 'fullName' | 'phone' | 'email'>;
  /** The customer's own include/exclude-from-checkout choices — persisted (unlike verification
   *  documents) so a refresh no longer silently re-includes something the customer had unchecked.
   *  Sanitized against the rest of this restored cart in loadPersistedCart, never trusted as-is. */
  checkoutSelection: CheckoutSelection;
}

const EMPTY_VERIFICATION_CONTACT: Pick<VerificationDocs, 'fullName' | 'phone' | 'email'> = {
  fullName: '',
  phone: '',
  email: '',
};

const EMPTY_PERSISTED_CART: Omit<PersistedCart, 'tripDetails'> = {
  selectedKits: [],
  kitExtras: {},
  packageAddOns: {},
  selectedItems: [],
  itemExtras: {},
  byoGears: [],
  byoAddOns: {},
  verificationContact: EMPTY_VERIFICATION_CONTACT,
  checkoutSelection: initialCheckoutSelection,
};

/**
 * Restores a persisted `checkoutSelection` against what actually survived the rest of restoration
 * above (selectedKits/selectedItems/packageAddOns/byoGears/byoAddOns, already sanitized) — a stale
 * id/key pointing at something that's gone (removed, corrupted, or dropped by sanitization) is
 * dropped rather than trusted, same reasoning as packageAddOns/byoAddOns' own sanitization just
 * above. `persisted` is `undefined` only for a cart saved before this field existed (an older
 * localStorage payload) — that one case falls back to the pre-existing "everything restored starts
 * selected" behavior for kits/items/byoGears only, since there's no real prior choice to preserve
 * for those. Package/BYO add-ons are deliberately NOT auto-selected in that fallback (unlike
 * kits/items/byoGears): an add-on the customer never re-confirmed this session must require an
 * explicit checkbox before it can ride along into an availability check or a booking — see the
 * "Tri-Pod Camping Fan" legacy-cart bug this fixes. Any other cart, however partial or malformed,
 * restores exactly what it can and discards the rest, never re-selecting something the customer
 * had actually unchecked.
 */
export function sanitizeCheckoutSelection(
  persisted: Partial<CheckoutSelection> | undefined,
  restored: {
    selectedKits: PackageKit[];
    selectedItems: IndividualItem[];
    packageAddOns: Record<string, BookableGearSelection[]>;
    byoGears: BookableGearSelection[];
    byoAddOns: Record<string, BookableAddOnSelection[]>;
  },
): CheckoutSelection {
  const validKitIds = new Set(restored.selectedKits.map((kit) => kit.id));
  const validItemIds = new Set(restored.selectedItems.map((item) => item.id));
  const validByoGearKeys = new Set(restored.byoGears.map((gear) => byoGearKey(gear)));

  if (!persisted) {
    // Kits/items/byoGears keep the pre-existing "everything restored starts selected" behavior —
    // there's no prior explicit choice to preserve for a cart this old, and it's the same
    // top-level entry a customer already reviews via its own checkbox on the Cart page. Add-ons,
    // however, start UNselected: they're a second, independent selection level the customer never
    // had a chance to set for this legacy cart, and defaulting them to selected is exactly what
    // silently reintroduced a stale add-on (e.g. "Tri-Pod Camping Fan") into an availability check
    // or booking payload the customer never asked for.
    return {
      kitIds: [...validKitIds],
      itemIds: [...validItemIds],
      byoGearKeys: [...validByoGearKeys],
      packageAddOnKeys: {},
      byoAddOnKeys: {},
    };
  }

  const packageAddOnKeys: Record<string, string[]> = {};
  for (const [kitId, keys] of Object.entries(persisted.packageAddOnKeys ?? {})) {
    if (!validKitIds.has(kitId) || !Array.isArray(keys)) continue;
    const validKeys = new Set((restored.packageAddOns[kitId] ?? []).map((gear) => byoGearKey(gear)));
    const kept = keys.filter((key) => validKeys.has(key));
    if (kept.length > 0) packageAddOnKeys[kitId] = kept;
  }
  const byoAddOnKeys: Record<string, string[]> = {};
  for (const [gearKey, keys] of Object.entries(persisted.byoAddOnKeys ?? {})) {
    if (!validByoGearKeys.has(gearKey) || !Array.isArray(keys)) continue;
    const validKeys = new Set((restored.byoAddOns[gearKey] ?? []).map((addOn) => byoGearKey(addOn)));
    const kept = keys.filter((key) => validKeys.has(key));
    if (kept.length > 0) byoAddOnKeys[gearKey] = kept;
  }

  return {
    kitIds: (Array.isArray(persisted.kitIds) ? persisted.kitIds : []).filter((id) => validKitIds.has(id)),
    itemIds: (Array.isArray(persisted.itemIds) ? persisted.itemIds : []).filter((id) => validItemIds.has(id)),
    byoGearKeys: (Array.isArray(persisted.byoGearKeys) ? persisted.byoGearKeys : []).filter((key) =>
      validByoGearKeys.has(key),
    ),
    packageAddOnKeys,
    byoAddOnKeys,
  };
}

function loadPersistedCart(storageKey: string): CartState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialCartState;

    const parsed = JSON.parse(raw) as Partial<PersistedCart>;

    // The guest key never carries actual cart contents (see persistCart's own guest branch) —
    // every add-to-cart mutation on this context already requires an authenticated user, so the
    // ONLY thing ever legitimately written there is tripDetails (dates/fulfillment, which a guest
    // is allowed to set while browsing before logging in). Any selectedKits/selectedItems/byoGears
    // found here can only be leftover data from before that rule existed (or direct localStorage
    // tampering) — never displayed or trusted, so a signed-out visitor can never see a stale or
    // otherwise-impossible cart badge/count.
    if (storageKey === GUEST_CART_STORAGE_KEY) {
      return { ...initialCartState, tripDetails: { ...initialTripDetails, ...parsed.tripDetails } };
    }

    const selectedKits = Array.isArray(parsed.selectedKits) ? parsed.selectedKits : [];
    const selectedItems = Array.isArray(parsed.selectedItems) ? parsed.selectedItems : [];
    // Same sanitization reasoning as byoAddOns below: an entry whose parent kit is no longer in
    // the restored cart is dropped outright, and a corrupted (non-positive/non-integer) quantity
    // is filtered out rather than trusted — these become real reserved inventory at submission.
    const validKitIds = new Set(selectedKits.map((kit) => kit.id));
    const packageAddOns: Record<string, BookableGearSelection[]> = {};
    for (const [kitId, gears] of Object.entries(parsed.packageAddOns ?? {})) {
      if (!validKitIds.has(kitId) || !Array.isArray(gears)) continue;
      const sanitized = gears.filter((gear) => Number.isInteger(gear?.quantity) && gear.quantity > 0);
      if (sanitized.length > 0) packageAddOns[kitId] = sanitized;
    }
    // Sanitized here, at hydration, rather than relying solely on REVALIDATE_AGAINST_CATALOG:
    // that pass deliberately leaves byoGears untouched whenever the (no-mock-fallback) gear
    // catalog hasn't loaded yet or failed to — correct for not wiping a legitimate BYO selection
    // on a transient outage, but it means a corrupted quantity (negative, zero, non-integer —
    // whether from manual localStorage tampering or a bug elsewhere) could otherwise sit in the
    // cart, priced and totaled as-is, for as long as the gear catalog stays unavailable.
    const byoGears = (Array.isArray(parsed.byoGears) ? parsed.byoGears : []).filter(
      (gear) => Number.isInteger(gear?.quantity) && gear.quantity > 0,
    );
    const validByoGearKeys = new Set(byoGears.map((gear) => byoGearKey(gear)));
    const byoAddOns: Record<string, BookableAddOnSelection[]> = {};
    for (const [key, addOns] of Object.entries(parsed.byoAddOns ?? {})) {
      if (!validByoGearKeys.has(key) || !Array.isArray(addOns)) continue;
      const sanitized = addOns.filter((a) => Number.isInteger(a?.quantity) && a.quantity > 0);
      if (sanitized.length > 0) byoAddOns[key] = sanitized;
    }
    return {
      ...initialCartState,
      selectedKits,
      kitExtras: parsed.kitExtras ?? {},
      packageAddOns,
      selectedItems,
      itemExtras: parsed.itemExtras ?? {},
      byoGears,
      byoAddOns,
      tripDetails: { ...initialTripDetails, ...parsed.tripDetails },
      // Only the plain contact fields restore — documents/confirmed/the agreement checkboxes
      // stay at their initial (empty) values exactly as before, so a stale unconfirmed upload
      // reference can never sit in the restored cart. See PersistedCart's own doc comment.
      verificationDocs: { ...initialVerificationDocs, ...parsed.verificationContact },
      checkoutSelection: sanitizeCheckoutSelection(parsed.checkoutSelection, {
        selectedKits,
        selectedItems,
        packageAddOns,
        byoGears,
        byoAddOns,
      }),
    };
  } catch {
    // Unavailable (private mode, disabled storage) or corrupt — start clean rather than throw.
    return initialCartState;
  }
}

function persistCart(storageKey: string, cart: CartState): void {
  try {
    // Belt-and-suspenders alongside loadPersistedCart's own guest-key handling: even if
    // cart.selectedKits/etc. were somehow non-empty in memory for a signed-out session, the guest
    // key on disk never records them — only tripDetails, which is the one thing a guest is
    // actually allowed to set before logging in.
    const payload: PersistedCart =
      storageKey === GUEST_CART_STORAGE_KEY
        ? { ...EMPTY_PERSISTED_CART, tripDetails: cart.tripDetails }
        : {
            selectedKits: cart.selectedKits,
            kitExtras: cart.kitExtras,
            packageAddOns: cart.packageAddOns,
            selectedItems: cart.selectedItems,
            itemExtras: cart.itemExtras,
            byoGears: cart.byoGears,
            byoAddOns: cart.byoAddOns,
            tripDetails: cart.tripDetails,
            verificationContact: {
              fullName: cart.verificationDocs.fullName,
              phone: cart.verificationDocs.phone,
              email: cart.verificationDocs.email,
            },
            checkoutSelection: cart.checkoutSelection,
          };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Storage unavailable or over quota — the cart still works for this session.
  }
}

/**
 * Maps every id a cart entry can legitimately hold to its current catalog entry. Kits sold in
 * editions enter the cart under the *edition's* id (see PathACatalog), so the lookup is keyed the
 * same way — otherwise a restored Khaki kit would never match its catalog row.
 */
function buildBookableKitLookup(kits: PackageKit[]): Map<string, PackageKit> {
  const lookup = new Map<string, PackageKit>();

  for (const kit of kits) {
    if (kit.editions && kit.editions.length > 0) {
      for (const edition of kit.editions) {
        lookup.set(edition.id, {
          ...kit,
          id: edition.id,
          name: `${kit.name} (${edition.label})`,
          imageUrl: edition.imageUrl,
          editions: undefined,
        });
      }
    } else {
      lookup.set(kit.id, kit);
    }
  }

  return lookup;
}

/** Drops selected add-on ids whose parent entry or add-on no longer exists in the catalog. */
function pruneExtras<T extends { id: string }>(
  extras: Record<string, string[]>,
  entries: T[],
  getAvailableIds: (entry: T) => { id: string }[],
): Record<string, string[]> {
  const allowed = new Map(entries.map((entry) => [entry.id, new Set(getAvailableIds(entry).map((e) => e.id))]));
  const pruned: Record<string, string[]> = {};
  let changed = false;

  for (const [entryId, selectedIds] of Object.entries(extras)) {
    const available = allowed.get(entryId);
    if (!available) {
      changed = true;
      continue;
    }
    const kept = selectedIds.filter((id) => available.has(id));
    if (kept.length !== selectedIds.length) changed = true;
    pruned[entryId] = kept;
  }

  return changed ? pruned : extras;
}

type CartAction =
  | { type: 'ADD_KIT'; kit: PackageKit }
  | { type: 'REMOVE_KIT'; kitId: string }
  | { type: 'ADD_KIT_EXTRA'; kitId: string; extraId: string }
  | { type: 'REMOVE_KIT_EXTRA'; kitId: string; extraId: string }
  | { type: 'ADD_ITEM'; item: IndividualItem }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'ADD_ITEM_EXTRA'; itemId: string; extraId: string }
  | { type: 'REMOVE_ITEM_EXTRA'; itemId: string; extraId: string }
  | { type: 'UPDATE_TRIP_DETAILS'; details: Partial<TripDetails> }
  | { type: 'UPDATE_VERIFICATION_DOCS'; docs: Partial<VerificationDocs> }
  // gearKinds is null while the (independently-loading, no-mock-fallback) gear catalog hasn't
  // resolved yet — meaning "leave byoGears/byoAddOns untouched," the same reasoning `ready`
  // already applies to kits/items: pruning against an empty catalog before the real one loads
  // would wrongly discard every restored Build Your Own selection.
  | { type: 'REVALIDATE_AGAINST_CATALOG'; kits: PackageKit[]; items: IndividualItem[]; gearKinds: BookableGearKind[] | null }
  | { type: 'DISMISS_REMOVED_NOTICE' }
  | { type: 'SET_BYO_GEAR_QUANTITY'; gear: BookableGearKind; quantity: number }
  | { type: 'SET_BYO_ADDON_QUANTITY'; gearKey: string; addOn: BookableAddOn; quantity: number }
  // Extra rentable inventory added on top of a selected PACKAGE — ordinary gear kinds from the
  // same live BYO catalog, submitted as bookingGears[] alongside packageCode. Never converts the
  // package into a Build Your Own selection; see CartState.packageAddOns' own comment.
  | { type: 'SET_PACKAGE_ADDON_QUANTITY'; kitId: string; gear: BookableGearKind; quantity: number }
  | { type: 'TOGGLE_KIT_SELECTED'; kitId: string }
  | { type: 'TOGGLE_ITEM_SELECTED'; itemId: string }
  | { type: 'TOGGLE_BYO_GEAR_SELECTED'; gearKey: string }
  // Independent checkout-selection toggle for one package add-on, scoped to its parent kit id —
  // excludes just this add-on from the next checkout without touching the kit or its other
  // add-ons, and without removing it from the cart (see CheckoutSelection.packageAddOnKeys).
  | { type: 'TOGGLE_PACKAGE_ADDON_SELECTED'; kitId: string; addOnKey: string }
  // Mirrors TOGGLE_PACKAGE_ADDON_SELECTED for a BYO add-on, scoped to its parent gear's byoGearKey.
  | { type: 'TOGGLE_BYO_ADDON_SELECTED'; gearKey: string; addOnKey: string }
  | { type: 'SET_ALL_CHECKOUT_SELECTED'; selected: boolean }
  | { type: 'CLEAR_CART' }
  // Wholesale-replaces the cart with whatever is stored under a different account's (or the
  // guest) storage key — dispatched only when the authenticated user actually changes (see
  // RentalProvider), never on every render. Deliberately a full replacement, not a merge: an
  // account switch must never let one account's in-progress cart bleed into another's.
  | { type: 'LOAD_CART'; cart: CartState };

/** Adds an id to a checkout-selection list if it isn't already there — used wherever an entry is
 * newly added to the cart, so it starts selected for checkout like every other entry. */
function withSelected(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id];
}

/** Drops an id from a checkout-selection list — used wherever an entry is removed from the cart,
 * so a stale reference never lingers in the selection. */
function withoutSelected(ids: string[], id: string): string[] {
  return ids.filter((existing) => existing !== id);
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    // Path A: kits are added/removed as single, indivisible units — no duplicates.
    case 'ADD_KIT': {
      if (state.selectedKits.some((kit) => kit.id === action.kit.id)) {
        return state;
      }
      return {
        ...state,
        selectedKits: [...state.selectedKits, action.kit],
        checkoutSelection: {
          ...state.checkoutSelection,
          kitIds: withSelected(state.checkoutSelection.kitIds, action.kit.id),
        },
      };
    }
    case 'REMOVE_KIT': {
      const kitExtras = Object.fromEntries(
        Object.entries(state.kitExtras).filter(([kitId]) => kitId !== action.kitId),
      );
      // Extra inventory belongs to the package it was added to — removing the package removes it
      // too, while every unrelated BYO selection (a different cart concept entirely) is untouched.
      const packageAddOns = Object.fromEntries(
        Object.entries(state.packageAddOns).filter(([kitId]) => kitId !== action.kitId),
      );
      const packageAddOnKeys = Object.fromEntries(
        Object.entries(state.checkoutSelection.packageAddOnKeys).filter(([kitId]) => kitId !== action.kitId),
      );
      return {
        ...state,
        selectedKits: state.selectedKits.filter((kit) => kit.id !== action.kitId),
        kitExtras,
        packageAddOns,
        checkoutSelection: {
          ...state.checkoutSelection,
          kitIds: withoutSelected(state.checkoutSelection.kitIds, action.kitId),
          packageAddOnKeys,
        },
      };
    }
    case 'TOGGLE_KIT_SELECTED': {
      const { kitIds } = state.checkoutSelection;
      return {
        ...state,
        checkoutSelection: {
          ...state.checkoutSelection,
          kitIds: kitIds.includes(action.kitId) ? withoutSelected(kitIds, action.kitId) : withSelected(kitIds, action.kitId),
        },
      };
    }

    // Duration-gated add-ons for a selected Path A kit.
    case 'ADD_KIT_EXTRA': {
      const existing = state.kitExtras[action.kitId] ?? [];
      if (existing.includes(action.extraId)) return state;
      return {
        ...state,
        kitExtras: { ...state.kitExtras, [action.kitId]: [...existing, action.extraId] },
      };
    }
    case 'REMOVE_KIT_EXTRA': {
      const existing = state.kitExtras[action.kitId] ?? [];
      return {
        ...state,
        kitExtras: {
          ...state.kitExtras,
          [action.kitId]: existing.filter((id) => id !== action.extraId),
        },
      };
    }

    // Path B: individual items are added/removed independently of any kit.
    case 'ADD_ITEM': {
      if (state.selectedItems.some((item) => item.id === action.item.id)) {
        return state;
      }
      return {
        ...state,
        selectedItems: [...state.selectedItems, action.item],
        checkoutSelection: {
          ...state.checkoutSelection,
          itemIds: withSelected(state.checkoutSelection.itemIds, action.item.id),
        },
      };
    }
    case 'REMOVE_ITEM': {
      const itemExtras = Object.fromEntries(
        Object.entries(state.itemExtras).filter(([itemId]) => itemId !== action.itemId),
      );
      return {
        ...state,
        selectedItems: state.selectedItems.filter((item) => item.id !== action.itemId),
        itemExtras,
        checkoutSelection: {
          ...state.checkoutSelection,
          itemIds: withoutSelected(state.checkoutSelection.itemIds, action.itemId),
        },
      };
    }
    case 'TOGGLE_ITEM_SELECTED': {
      const { itemIds } = state.checkoutSelection;
      return {
        ...state,
        checkoutSelection: {
          ...state.checkoutSelection,
          itemIds: itemIds.includes(action.itemId) ? withoutSelected(itemIds, action.itemId) : withSelected(itemIds, action.itemId),
        },
      };
    }

    // Duration-gated paid add-ons for a selected Path B item (e.g. Extra Canopy Poles).
    case 'ADD_ITEM_EXTRA': {
      const existing = state.itemExtras[action.itemId] ?? [];
      if (existing.includes(action.extraId)) return state;
      return {
        ...state,
        itemExtras: { ...state.itemExtras, [action.itemId]: [...existing, action.extraId] },
      };
    }
    case 'REMOVE_ITEM_EXTRA': {
      const existing = state.itemExtras[action.itemId] ?? [];
      return {
        ...state,
        itemExtras: {
          ...state.itemExtras,
          [action.itemId]: existing.filter((id) => id !== action.extraId),
        },
      };
    }

    // Build Your Own: quantity 0 removes the gear (and any add-ons selected for it); a positive
    // quantity upserts the full kind snapshot, mirroring how ADD_KIT stores the whole PackageKit.
    case 'SET_BYO_GEAR_QUANTITY': {
      const key = byoGearKey(action.gear);
      const withoutGear = state.byoGears.filter((g) => byoGearKey(g) !== key);

      if (action.quantity <= 0) {
        const byoAddOns = { ...state.byoAddOns };
        delete byoAddOns[key];
        const byoAddOnKeys = { ...state.checkoutSelection.byoAddOnKeys };
        delete byoAddOnKeys[key];
        return {
          ...state,
          byoGears: withoutGear,
          byoAddOns,
          checkoutSelection: {
            ...state.checkoutSelection,
            byoGearKeys: withoutSelected(state.checkoutSelection.byoGearKeys, key),
            byoAddOnKeys,
          },
        };
      }

      return {
        ...state,
        byoGears: [...withoutGear, { ...action.gear, quantity: action.quantity }],
        checkoutSelection: {
          ...state.checkoutSelection,
          byoGearKeys: withSelected(state.checkoutSelection.byoGearKeys, key),
        },
      };
    }
    case 'TOGGLE_BYO_GEAR_SELECTED': {
      const { byoGearKeys } = state.checkoutSelection;
      return {
        ...state,
        checkoutSelection: {
          ...state.checkoutSelection,
          byoGearKeys: byoGearKeys.includes(action.gearKey)
            ? withoutSelected(byoGearKeys, action.gearKey)
            : withSelected(byoGearKeys, action.gearKey),
        },
      };
    }

    // Add-ons only make sense attached to a gear the customer has actually selected; the UI never
    // offers this control otherwise, but the reducer stays defensive rather than trusting that.
    case 'SET_BYO_ADDON_QUANTITY': {
      if (!state.byoGears.some((g) => byoGearKey(g) === action.gearKey)) return state;

      const addOnKey = byoGearKey(action.addOn);
      const existing = state.byoAddOns[action.gearKey] ?? [];
      const hadAddOn = existing.some((a) => byoGearKey(a) === addOnKey);
      const withoutAddOn = existing.filter((a) => byoGearKey(a) !== addOnKey);
      const nextForGear =
        action.quantity <= 0 ? withoutAddOn : [...withoutAddOn, { ...action.addOn, quantity: action.quantity }];

      // Mirrors ADD_KIT/ADD_ITEM/SET_BYO_GEAR_QUANTITY: a newly added add-on starts selected for
      // checkout; going to quantity 0 (removal) drops its selection reference the same way
      // SET_BYO_GEAR_QUANTITY(0) does above; an ordinary quantity change on an already-present
      // add-on leaves its existing checked/unchecked state untouched.
      const existingKeys = state.checkoutSelection.byoAddOnKeys[action.gearKey] ?? [];
      const nextKeys =
        action.quantity <= 0
          ? withoutSelected(existingKeys, addOnKey)
          : hadAddOn
            ? existingKeys
            : withSelected(existingKeys, addOnKey);
      const byoAddOnKeys = { ...state.checkoutSelection.byoAddOnKeys };
      if (nextKeys.length > 0) byoAddOnKeys[action.gearKey] = nextKeys;
      else delete byoAddOnKeys[action.gearKey];

      return {
        ...state,
        byoAddOns: { ...state.byoAddOns, [action.gearKey]: nextForGear },
        checkoutSelection: { ...state.checkoutSelection, byoAddOnKeys },
      };
    }
    case 'TOGGLE_BYO_ADDON_SELECTED': {
      const existingKeys = state.checkoutSelection.byoAddOnKeys[action.gearKey] ?? [];
      const nextKeys = existingKeys.includes(action.addOnKey)
        ? withoutSelected(existingKeys, action.addOnKey)
        : withSelected(existingKeys, action.addOnKey);
      return {
        ...state,
        checkoutSelection: {
          ...state.checkoutSelection,
          byoAddOnKeys: { ...state.checkoutSelection.byoAddOnKeys, [action.gearKey]: nextKeys },
        },
      };
    }

    // Mirrors SET_BYO_GEAR_QUANTITY's upsert, but scoped to one selected package's extra
    // inventory: quantity 0 removes the line, a positive quantity stores the full catalog
    // snapshot (price/availability included) exactly as byoGears does. Guarded on the kit
    // actually being selected so a stale control can never attach inventory to nothing.
    case 'SET_PACKAGE_ADDON_QUANTITY': {
      if (!state.selectedKits.some((kit) => kit.id === action.kitId)) return state;

      const key = byoGearKey(action.gear);
      const existing = state.packageAddOns[action.kitId] ?? [];
      const hadGear = existing.some((gear) => byoGearKey(gear) === key);
      const withoutGear = existing.filter((gear) => byoGearKey(gear) !== key);
      const nextForKit =
        action.quantity <= 0 ? withoutGear : [...withoutGear, { ...action.gear, quantity: action.quantity }];

      // Same selection bookkeeping as SET_BYO_ADDON_QUANTITY above — newly added starts selected,
      // quantity 0 (removal) drops the selection reference, an ordinary quantity change on an
      // already-present add-on leaves its checked/unchecked state as the customer set it.
      const existingKeys = state.checkoutSelection.packageAddOnKeys[action.kitId] ?? [];
      const nextKeys =
        action.quantity <= 0
          ? withoutSelected(existingKeys, key)
          : hadGear
            ? existingKeys
            : withSelected(existingKeys, key);
      const packageAddOnKeys = { ...state.checkoutSelection.packageAddOnKeys };
      if (nextKeys.length > 0) packageAddOnKeys[action.kitId] = nextKeys;
      else delete packageAddOnKeys[action.kitId];

      return {
        ...state,
        packageAddOns: { ...state.packageAddOns, [action.kitId]: nextForKit },
        checkoutSelection: { ...state.checkoutSelection, packageAddOnKeys },
      };
    }
    case 'TOGGLE_PACKAGE_ADDON_SELECTED': {
      const existingKeys = state.checkoutSelection.packageAddOnKeys[action.kitId] ?? [];
      const nextKeys = existingKeys.includes(action.addOnKey)
        ? withoutSelected(existingKeys, action.addOnKey)
        : withSelected(existingKeys, action.addOnKey);
      return {
        ...state,
        checkoutSelection: {
          ...state.checkoutSelection,
          packageAddOnKeys: { ...state.checkoutSelection.packageAddOnKeys, [action.kitId]: nextKeys },
        },
      };
    }

    case 'UPDATE_TRIP_DETAILS': {
      return { ...state, tripDetails: { ...state.tripDetails, ...action.details } };
    }
    case 'UPDATE_VERIFICATION_DOCS': {
      return { ...state, verificationDocs: { ...state.verificationDocs, ...action.docs } };
    }

    /**
     * Reconciles a restored cart against the live catalog. Entries whose id no longer exists are
     * dropped, and surviving entries are *replaced* by the catalog's own object so that persisted
     * prices, deposits and stock flags can never outlive the catalog they came from. Prices in
     * storage are a stale snapshot, never authority — the RMS remains authoritative at booking.
     */
    case 'REVALIDATE_AGAINST_CATALOG': {
      const kitLookup = buildBookableKitLookup(action.kits);
      const itemLookup = new Map(action.items.map((item) => [item.id, item]));
      const gearLookup = action.gearKinds ? new Map(action.gearKinds.map((gear) => [byoGearKey(gear), gear])) : null;

      const selectedKits = state.selectedKits
        .map((kit) => kitLookup.get(kit.id))
        .filter((kit): kit is PackageKit => kit !== undefined);
      const selectedItems = state.selectedItems
        .map((item) => itemLookup.get(item.id))
        .filter((item): item is IndividualItem => item !== undefined);

      const kitExtras = pruneExtras(state.kitExtras, selectedKits, (kit) => kit.extras ?? []);
      const itemExtras = pruneExtras(state.itemExtras, selectedItems, (item) => item.paidAddOns ?? []);

      // Re-snapshots each selected gear from the live catalog (fresh price/availability), drops
      // anything no longer sold, and clamps quantity down to the current availableCount — never
      // up, so a customer's own deliberate lower selection is never silently increased. Skipped
      // entirely (byoGears/byoAddOns pass through unchanged) while gearLookup is null, i.e. the
      // gear catalog hasn't resolved yet.
      const byoGears = gearLookup
        ? state.byoGears
            .map((selection) => {
              const fresh = gearLookup.get(byoGearKey(selection));
              if (!fresh || !fresh.canSelect) return undefined;
              const quantity = Math.min(selection.quantity, fresh.availableCount);
              if (quantity <= 0) return undefined;
              return { ...fresh, quantity };
            })
            .filter((gear): gear is BookableGearSelection => gear !== undefined)
        : state.byoGears;

      let byoAddOns = state.byoAddOns;
      if (gearLookup) {
        byoAddOns = {};
        for (const gear of byoGears) {
          const key = byoGearKey(gear);
          const selectedAddOns = state.byoAddOns[key] ?? [];
          const addOnLookup = new Map(gear.compatibleAddOns.map((addOn) => [byoGearKey(addOn), addOn]));
          const nextAddOns = selectedAddOns
            .map((selection) => {
              const fresh = addOnLookup.get(byoGearKey(selection));
              if (!fresh) return undefined;
              const quantity = Math.min(selection.quantity, fresh.availableCount, fresh.maxQuantity);
              if (quantity <= 0) return undefined;
              return { ...fresh, quantity };
            })
            .filter((addOn): addOn is BookableAddOnSelection => addOn !== undefined);
          if (nextAddOns.length > 0) byoAddOns[key] = nextAddOns;
        }
        // Add-on entries for gear dropped above are implicitly dropped too — this loop only ever
        // rebuilds byoAddOns from the surviving byoGears.
      }

      // Drops any selection reference to an entry this revalidation just dropped — same "never
      // outlive the cart entry it points at" rule REMOVE_KIT/REMOVE_ITEM/SET_BYO_GEAR_QUANTITY(0)
      // already enforce, just applied here for entries the *catalog* removed instead of the
      // customer.
      const kitIdSet = new Set(selectedKits.map((kit) => kit.id));
      const itemIdSet = new Set(selectedItems.map((item) => item.id));
      const byoGearKeySet = new Set(byoGears.map((gear) => byoGearKey(gear)));

      // Package extra-inventory gets the same treatment byoGears above already receives: dropped
      // when its parent package is gone, and — once the gear catalog has actually loaded — each
      // line re-snapshotted from the live catalog with its quantity clamped down (never up) to the
      // current availableCount. Skipped entirely while gearLookup is null so a slow/failed gear
      // catalog can't wipe a restored selection. Preserves the original reference when nothing
      // changed, so the `unchanged` check below doesn't see a false change every revalidation.
      let packageAddOns = state.packageAddOns;
      const packageAddOnEntries = Object.entries(state.packageAddOns);
      if (gearLookup || packageAddOnEntries.some(([kitId]) => !kitIdSet.has(kitId))) {
        const nextPackageAddOns: Record<string, BookableGearSelection[]> = {};
        for (const [kitId, gears] of packageAddOnEntries) {
          if (!kitIdSet.has(kitId)) continue;
          const nextGears = gearLookup
            ? gears
                .map((selection) => {
                  const fresh = gearLookup.get(byoGearKey(selection));
                  if (!fresh || !fresh.canSelect) return undefined;
                  const quantity = Math.min(selection.quantity, fresh.availableCount);
                  if (quantity <= 0) return undefined;
                  return { ...fresh, quantity };
                })
                .filter((gear): gear is BookableGearSelection => gear !== undefined)
            : gears;
          if (nextGears.length > 0) nextPackageAddOns[kitId] = nextGears;
        }
        if (JSON.stringify(nextPackageAddOns) !== JSON.stringify(state.packageAddOns)) {
          packageAddOns = nextPackageAddOns;
        }
      }

      // Same "never outlive the entry it points at" pruning as kitIds/itemIds/byoGearKeys just
      // above, one level down: an add-on selection reference is dropped once either its parent (no
      // longer in kitIdSet/byoGearKeySet) or the add-on itself (re-snapshotted out of packageAddOns/
      // byoAddOns above) is gone.
      const packageAddOnKeys: Record<string, string[]> = {};
      for (const [kitId, keys] of Object.entries(state.checkoutSelection.packageAddOnKeys)) {
        if (!kitIdSet.has(kitId)) continue;
        const validKeys = new Set((packageAddOns[kitId] ?? []).map((gear) => byoGearKey(gear)));
        const kept = keys.filter((key) => validKeys.has(key));
        if (kept.length > 0) packageAddOnKeys[kitId] = kept;
      }
      const byoAddOnKeys: Record<string, string[]> = {};
      for (const [gearKey, keys] of Object.entries(state.checkoutSelection.byoAddOnKeys)) {
        if (!byoGearKeySet.has(gearKey)) continue;
        const validKeys = new Set((byoAddOns[gearKey] ?? []).map((addOn) => byoGearKey(addOn)));
        const kept = keys.filter((key) => validKeys.has(key));
        if (kept.length > 0) byoAddOnKeys[gearKey] = kept;
      }

      const checkoutSelection: CheckoutSelection = {
        kitIds: state.checkoutSelection.kitIds.filter((id) => kitIdSet.has(id)),
        itemIds: state.checkoutSelection.itemIds.filter((id) => itemIdSet.has(id)),
        byoGearKeys: state.checkoutSelection.byoGearKeys.filter((key) => byoGearKeySet.has(key)),
        packageAddOnKeys,
        byoAddOnKeys,
      };

      const unchanged =
        selectedKits.length === state.selectedKits.length &&
        selectedItems.length === state.selectedItems.length &&
        selectedKits.every((kit, index) => kit === state.selectedKits[index]) &&
        selectedItems.every((item, index) => item === state.selectedItems[index]) &&
        kitExtras === state.kitExtras &&
        itemExtras === state.itemExtras &&
        byoGears.length === state.byoGears.length &&
        byoGears.every((gear, index) => gear.quantity === state.byoGears[index]?.quantity && byoGearKey(gear) === byoGearKey(state.byoGears[index])) &&
        JSON.stringify(byoAddOns) === JSON.stringify(state.byoAddOns) &&
        packageAddOns === state.packageAddOns &&
        JSON.stringify(checkoutSelection) === JSON.stringify(state.checkoutSelection);

      if (unchanged) return state;

      // Names of entries this pass actually dropped (never entries the customer removed
      // themselves — those go through REMOVE_KIT/REMOVE_ITEM/SET_BYO_GEAR_QUANTITY(0), which don't
      // touch this list) — surfaced once as a dismissible notice on the Cart page so a package or
      // gear going out of stock/deactivated between visits is never a silent disappearance.
      const droppedKitNames = state.selectedKits
        .filter((kit) => !kitIdSet.has(kit.id))
        .map((kit) => kit.name);
      const droppedItemNames = state.selectedItems
        .filter((item) => !itemIdSet.has(item.id))
        .map((item) => item.name);
      const droppedGearNames = gearLookup
        ? state.byoGears.filter((gear) => !byoGearKeySet.has(byoGearKey(gear))).map((gear) => gear.name)
        : [];
      const removedItemNames = [...droppedKitNames, ...droppedItemNames, ...droppedGearNames];

      return {
        ...state,
        selectedKits,
        selectedItems,
        kitExtras,
        packageAddOns,
        itemExtras,
        byoGears,
        byoAddOns,
        checkoutSelection,
        removedItemNames: removedItemNames.length > 0 ? removedItemNames : state.removedItemNames,
      };
    }

    case 'DISMISS_REMOVED_NOTICE': {
      if (state.removedItemNames.length === 0) return state;
      return { ...state, removedItemNames: [] };
    }

    // Bulk check/uncheck for the Cart page's "Select All" control — selected:true checks every
    // entry currently in the cart, selected:false clears the whole checkout selection, same as
    // toggling each item individually would but in one dispatch.
    case 'SET_ALL_CHECKOUT_SELECTED': {
      if (!action.selected) {
        return {
          ...state,
          checkoutSelection: { kitIds: [], itemIds: [], byoGearKeys: [], packageAddOnKeys: {}, byoAddOnKeys: {} },
        };
      }
      const packageAddOnKeys: Record<string, string[]> = {};
      for (const [kitId, gears] of Object.entries(state.packageAddOns)) {
        packageAddOnKeys[kitId] = gears.map((gear) => byoGearKey(gear));
      }
      const byoAddOnKeys: Record<string, string[]> = {};
      for (const [gearKey, addOns] of Object.entries(state.byoAddOns)) {
        byoAddOnKeys[gearKey] = addOns.map((addOn) => byoGearKey(addOn));
      }
      return {
        ...state,
        checkoutSelection: {
          kitIds: state.selectedKits.map((kit) => kit.id),
          itemIds: state.selectedItems.map((item) => item.id),
          byoGearKeys: state.byoGears.map((gear) => byoGearKey(gear)),
          packageAddOnKeys,
          byoAddOnKeys,
        },
      };
    }

    case 'CLEAR_CART': {
      return initialCartState;
    }

    case 'LOAD_CART': {
      return action.cart;
    }

    default:
      return state;
  }
}

/**
 * Narrows a cart down to only the entries currently checked for checkout — everything downstream
 * of the cart that cares about "what's actually being booked right now" (the totals shown on the
 * Cart page footer, and everything PaymentBreakdown reads/submits) should read from this, never
 * from the raw cart directly, or an unchecked package/BYO item the customer meant to save for
 * later would still get counted or submitted. `tripDetails`/`verificationDocs` pass through
 * unchanged — those aren't per-entry.
 */
export function filterCartToSelection(cart: CartState): CartState {
  const { kitIds, itemIds, byoGearKeys, packageAddOnKeys, byoAddOnKeys } = cart.checkoutSelection;
  const kitIdSet = new Set(kitIds);
  const itemIdSet = new Set(itemIds);
  const byoGearKeySet = new Set(byoGearKeys);

  const selectedKits = cart.selectedKits.filter((kit) => kitIdSet.has(kit.id));
  const selectedItems = cart.selectedItems.filter((item) => itemIdSet.has(item.id));
  const byoGears = cart.byoGears.filter((gear) => byoGearKeySet.has(byoGearKey(gear)));

  const kitExtras = pruneExtras(cart.kitExtras, selectedKits, (kit) => kit.extras ?? []);
  const itemExtras = pruneExtras(cart.itemExtras, selectedItems, (item) => item.paidAddOns ?? []);

  // Two-level narrowing, mirroring kitIds/byoGearKeys above one level down: an add-on is included
  // only when its PARENT is checked (an unchecked package/BYO gear can never submit or be billed
  // for gear attached to it) AND the add-on itself is checked — a customer can exclude just one
  // add-on from this checkout while leaving its parent, and every other add-on under it, untouched.
  const byoAddOns: Record<string, BookableAddOnSelection[]> = {};
  for (const [gearKey, addOns] of Object.entries(cart.byoAddOns)) {
    if (!byoGearKeySet.has(gearKey)) continue;
    const selectedKeys = new Set(byoAddOnKeys[gearKey] ?? []);
    const kept = addOns.filter((addOn) => selectedKeys.has(byoGearKey(addOn)));
    if (kept.length > 0) byoAddOns[gearKey] = kept;
  }
  const packageAddOns: Record<string, BookableGearSelection[]> = {};
  for (const [kitId, gears] of Object.entries(cart.packageAddOns)) {
    if (!kitIdSet.has(kitId)) continue;
    const selectedKeys = new Set(packageAddOnKeys[kitId] ?? []);
    const kept = gears.filter((gear) => selectedKeys.has(byoGearKey(gear)));
    if (kept.length > 0) packageAddOns[kitId] = kept;
  }

  return { ...cart, selectedKits, selectedItems, kitExtras, packageAddOns, itemExtras, byoGears, byoAddOns };
}

/** Whole rental days between startDate and returnDate; 0 if either date is missing/invalid. */
export function calculateRentalDurationDays(tripDetails: TripDetails): number {
  const { startDate, returnDate } = tripDetails;
  if (!startDate || !returnDate) return 0;

  const start = new Date(startDate);
  const end = new Date(returnDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 0;
  }

  return Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY));
}

/** Total refundable security deposit, due at checkout regardless of trip duration. */
export function calculateDueToday(cart: CartState): number {
  const kitDeposits = cart.selectedKits.reduce((sum, kit) => sum + kit.depositAmount, 0);
  const itemDeposits = cart.selectedItems.reduce((sum, item) => sum + item.depositAmount, 0);
  return kitDeposits + itemDeposits;
}

/** Total one-time fee for every selected Path A kit add-on across all selected kits. */
export function calculateKitExtrasFee(cart: CartState): number {
  return cart.selectedKits.reduce((sum, kit) => {
    const selectedIds = cart.kitExtras[kit.id] ?? [];
    const kitExtrasTotal = (kit.extras ?? [])
      .filter((extra) => selectedIds.includes(extra.id))
      .reduce((extraSum, extra) => extraSum + extra.price, 0);
    return sum + kitExtrasTotal;
  }, 0);
}

/** Total one-time fee for every selected Path B item paid add-on across all selected items. */
export function calculateItemExtrasFee(cart: CartState): number {
  return cart.selectedItems.reduce((sum, item) => {
    const selectedIds = cart.itemExtras[item.id] ?? [];
    const itemExtrasTotal = (item.paidAddOns ?? [])
      .filter((addOn) => selectedIds.includes(addOn.id))
      .reduce((addOnSum, addOn) => addOnSum + addOn.price, 0);
    return sum + itemExtrasTotal;
  }, 0);
}

/**
 * Resolves the trip's duration to a kit's price. 48h and 72h remain fixed tier prices, exactly as
 * before; a duration beyond 72h now correctly uses the RMS's own configured per-extra-day rate
 * (`kit.extraPerDayPrice`, defaulting to 0) via the same `pickGearTierPrice` formula Build Your Own
 * gear already uses — see that function's own doc comment. Previously any non-2-day, non-3-day
 * duration silently fell back to the 48h price (a documented bug, not a business rule — see
 * RentalContext.test.ts); this only changes that one previously-undefined case, never the 48h- or
 * 72h-exactly behavior itself.
 */
export function getKitPrice(kit: PackageKit, tripDetails: TripDetails): number {
  return pickGearTierPrice(calculateRentalDurationHours(tripDetails), kit.pricing, kit.extraPerDayPrice ?? 0);
}

/**
 * Real gear (RentableGear) is only bookable at the 48h or 72h tier, same as kits — resolves the
 * trip's duration to a tier and returns that item's price; defensively falls back to the 48h tier
 * for any other duration (mirrors getKitPrice).
 */
export function getItemPrice(item: IndividualItem, tripDetails: TripDetails): number {
  const durationDays = calculateRentalDurationDays(tripDetails);
  return durationDays === 3 ? item.pricing['72h'] : item.pricing['48h'];
}

/** Whole rental hours between startDate and returnDate — the same unit the RMS's own pricing
 * formula (pickTierPrice) uses. Display-only approximation from calendar dates alone (no time of
 * day is chosen at the Build Your Own browsing stage yet); the RMS always recomputes the
 * authoritative amount from the real pickupAt/returnAt timestamps at submission. */
export function calculateRentalDurationHours(tripDetails: TripDetails): number {
  return calculateRentalDurationDays(tripDetails) * 24;
}

/**
 * Mirrors the RMS's own pickTierPrice formula exactly (src/server/bookings/service.ts in the
 * RMS): 48h tier up to 48 hours, 72h tier up to 72 hours, then the 72h tier plus one
 * extraPerDayPrice for each additional full-or-partial day beyond 72h. Display only — the RMS
 * always recomputes and is the sole authority when the booking is actually created.
 */
export function pickGearTierPrice(
  durationHours: number,
  pricing: { '48h': number; '72h': number },
  extraPerDayPrice: number,
): number {
  if (durationHours <= 48) return pricing['48h'];
  if (durationHours <= 72) return pricing['72h'];
  const extraDays = Math.ceil((durationHours - 72) / 24);
  return pricing['72h'] + extraDays * extraPerDayPrice;
}

/** Per-unit price of one Build Your Own gear kind (or its add-on) at the trip's current duration. */
export function getGearKindPrice(
  gear: { pricing: { '48h': number; '72h': number }; extraPerDayPrice: number },
  tripDetails: TripDetails,
): number {
  return pickGearTierPrice(calculateRentalDurationHours(tripDetails), gear.pricing, gear.extraPerDayPrice);
}

/** Total rental fee for every selected Build Your Own gear kind, quantity included. */
export function calculateByoGearsFee(cart: CartState): number {
  return cart.byoGears.reduce(
    (sum, gear) => sum + getGearKindPrice(gear, cart.tripDetails) * gear.quantity,
    0,
  );
}

/** Total rental fee for every selected Build Your Own add-on across all selected gear, quantity included. */
export function calculateByoAddOnsFee(cart: CartState): number {
  return Object.values(cart.byoAddOns)
    .flat()
    .reduce((sum, addOn) => sum + getGearKindPrice(addOn, cart.tripDetails) * addOn.quantity, 0);
}

/** Total rental fee for every extra rentable item added on top of a selected package, quantity
 * included. Reuses getGearKindPrice exactly like calculateByoGearsFee — these are the same gear
 * kinds at the same catalog prices; only the cart field they live in differs. Display only: the
 * RMS recomputes and is the sole authority when the booking is actually created. */
export function calculatePackageAddOnsFee(cart: CartState): number {
  return Object.values(cart.packageAddOns)
    .flat()
    .reduce((sum, gear) => sum + getGearKindPrice(gear, cart.tripDetails) * gear.quantity, 0);
}

/** Total rental fee owed before the trip starts: kit tier prices + extras + package extra
 * inventory + item tier prices + Build Your Own gear and add-on prices. Display only — see
 * calculateByoGearsFee. */
export function calculateDueBeforeStart(cart: CartState): number {
  const kitFees = cart.selectedKits.reduce((sum, kit) => sum + getKitPrice(kit, cart.tripDetails), 0);
  const itemFees = cart.selectedItems.reduce(
    (sum, item) => sum + getItemPrice(item, cart.tripDetails),
    0,
  );

  return (
    kitFees +
    calculateKitExtrasFee(cart) +
    calculatePackageAddOnsFee(cart) +
    itemFees +
    calculateItemExtrasFee(cart) +
    calculateByoGearsFee(cart) +
    calculateByoAddOnsFee(cart)
  );
}

function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * System rule: a package kit is validated as a single bundled unit against mock blackout
 * windows. `range` is null until the customer picks dates; pending real RMS integration.
 * A kit marked `isOutOfStock` is never bookable regardless of dates — it still appears in the
 * catalog (visible in catalog ≠ available for booking), it just can't be added to the cart.
 */
export function checkKitAvailability(kit: PackageKit, range: DateRange | null): boolean {
  if (kit.isOutOfStock) return false;
  if (!range) return true;
  return !(kit.unavailableRanges ?? []).some((blocked) => rangesOverlap(range, blocked));
}

/**
 * System rule: an individual item is validated independently of any kit against mock
 * blackout windows. `range` is null until the customer picks dates; pending real RMS integration.
 * Same out-of-stock short-circuit as `checkKitAvailability`.
 */
export function checkItemAvailability(item: IndividualItem, range: DateRange | null): boolean {
  if (item.isOutOfStock) return false;
  if (!range) return true;
  return !(item.unavailableRanges ?? []).some((blocked) => rangesOverlap(range, blocked));
}

/** Every slot that must be filled before a booking may be submitted. */
export const REQUIRED_VERIFICATION_DOCUMENTS: VerificationDocumentKey[] = [
  'idType1',
  'idType2',
  'verificationVideo',
  'proofOfBilling',
];

/**
 * Gate for the final booking submission. Deliberately artifact-agnostic: it asks only whether a
 * file has been successfully uploaded for each required slot, never what kind of file it is, so
 * it stays correct whichever artifact the face-verification slot ends up requiring.
 *
 * Requires `storagePath` specifically, not just a selected file — a slot whose upload is still in
 * flight or has failed has metadata but no storagePath yet, and must not pass this gate.
 *
 * `isByoBooking` decides which ONE of the two agreements is required: the Kit "Terms &
 * Conditions" PDF for a package booking, or the "BYO Rental Agreement" PDF for a Build Your Own
 * one — never both, never neither. These are two independent, self-contained legal documents (the
 * BYO agreement carries its own full general-terms section and signature block, not an addendum
 * to the Kit one), confirmed against the actual PDFs and mirrored server-side by
 * customerPortalBookingSchema's own refines. `isByoBooking` is a caller-supplied fact (derived the
 * same way PaymentBreakdown's own `isByoOnly` is: a checked-for-checkout cart with BYO gear and no
 * package) rather than something this function infers from `docs` itself, since VerificationDocs
 * carries no cart composition of its own.
 */
export function isVerificationComplete(docs: VerificationDocs, isByoBooking: boolean): boolean {
  const contactComplete = Boolean(docs.fullName.trim() && docs.phone.trim() && docs.email.trim());
  const documentsComplete = REQUIRED_VERIFICATION_DOCUMENTS.every((key) => docs.documents[key]?.storagePath);
  const agreementsComplete = isByoBooking ? docs.byoAgreementAccepted : docs.termsAccepted;
  return contactComplete && documentsComplete && agreementsComplete && docs.confirmed;
}

interface RentalTotals {
  rentalDurationDays: number;
  dueToday: number;
  dueBeforeStart: number;
}

interface RentalContextValue {
  cart: CartState;
  dispatch: Dispatch<CartAction>;
  totals: RentalTotals;
  /** False (and no-op) when called while signed out — see the "must be logged in to add to cart"
   *  gate below. Every add-style mutator on this context returns this same signal so a caller can
   *  react (e.g. redirect to /login) instead of a click silently doing nothing. */
  addKit: (kit: PackageKit) => boolean;
  removeKit: (kitId: string) => void;
  addKitExtra: (kitId: string, extraId: string) => boolean;
  removeKitExtra: (kitId: string, extraId: string) => void;
  addItem: (item: IndividualItem) => boolean;
  removeItem: (itemId: string) => void;
  addItemExtra: (itemId: string, extraId: string) => boolean;
  removeItemExtra: (itemId: string, extraId: string) => void;
  /** Sets the selected quantity of a Build Your Own gear kind; 0 removes it (and its add-ons).
   *  Only an actual increase requires being signed in — lowering/zeroing an existing selection is
   *  always allowed, same as every other removal path on this context. */
  setByoGearQuantity: (gear: BookableGearKind, quantity: number) => boolean;
  /** Sets the selected quantity of an add-on for a given gear (keyed by byoGearKey); 0 removes it.
   *  Same increase-only gate as setByoGearQuantity. */
  setByoAddOnQuantity: (gearKey: string, addOn: BookableAddOn, quantity: number) => boolean;
  /** Sets the quantity of one extra rentable item attached to a selected package (keyed by that
   *  kit's cart id); 0 removes it. Same increase-only auth gate as setByoGearQuantity, and never
   *  converts the package into a Build Your Own selection. */
  setPackageAddOnQuantity: (kitId: string, gear: BookableGearKind, quantity: number) => boolean;
  updateTripDetails: (details: Partial<TripDetails>) => void;
  updateVerificationDocs: (docs: Partial<VerificationDocs>) => void;
  /** Toggles whether a cart entry is included in the *next* checkout — see CheckoutSelection. */
  toggleKitSelected: (kitId: string) => void;
  toggleItemSelected: (itemId: string) => void;
  toggleByoGearSelected: (gearKey: string) => void;
  /** Toggles whether one package add-on (identified by byoGearKey, scoped to its parent kit id) is
   *  included in the next checkout, independent of its parent kit and every other add-on under it. */
  togglePackageAddOnSelected: (kitId: string, addOnKey: string) => void;
  /** Mirrors togglePackageAddOnSelected for a BYO add-on, scoped to its parent gear's byoGearKey. */
  toggleByoAddOnSelected: (gearKey: string, addOnKey: string) => void;
  /** Checks (true) or unchecks (false) every entry currently in the cart at once — the Cart
   *  page's "Select All" / "Deselect All" control. */
  setAllCheckoutSelected: (selected: boolean) => void;
  clearCart: () => void;
  /** Dismisses the "some items were removed" notice — see CartState.removedItemNames. */
  dismissRemovedNotice: () => void;
}

const RentalContext = createContext<RentalContextValue | undefined>(undefined);

export function RentalProvider({ children }: { children: ReactNode }) {
  const { kits, items, ready, gearKinds, gearCatalogState } = useCatalog();
  const { user, loading: authLoading } = useAuth();
  // Starts from the guest cart unconditionally — auth hasn't resolved yet on first render, and
  // this matches exactly what already worked before per-account carts existed, so a pure guest
  // session (or the moment before login state is known) never regresses.
  const [cart, dispatch] = useReducer(cartReducer, undefined, () => loadPersistedCart(GUEST_CART_STORAGE_KEY));

  // Which localStorage key `cart` currently reflects — a ref (not state) because it must be
  // readable at the exact instant the persist effect below runs, without itself triggering a
  // re-render. Updated synchronously by the account-switch effect right before it dispatches
  // LOAD_CART, so persistCart always writes to the right place even in the same commit the cart
  // switches accounts.
  const cartStorageKeyRef = useRef(GUEST_CART_STORAGE_KEY);
  // The previously-seen auth user id, so the switch below only ever runs on an actual sign-in/
  // sign-out/account-change — never merely because some other value in this component re-rendered
  // it. `undefined` means "auth hasn't resolved even once yet".
  const lastAuthUserIdRef = useRef<string | null | undefined>(undefined);

  // The actual fix for a cart "belonging" to the wrong signed-in customer: each authenticated
  // account gets its own storage key, isolated from every other account and from the guest cart,
  // on the same browser. Runs only when the resolved user id changes (sign-in, sign-out, or
  // switching accounts) — a first-time sign-in on this browser (this account has no cart of its
  // own here yet) starts that account with a genuinely empty cart; a returning account's own cart
  // is used as-is; signing out switches back to the guest key without touching either cart.
  //
  // Deliberately NEVER migrates the guest cart into a newly authenticated account, even on a
  // first-ever sign-in/signup on this browser: the guest cart belongs only to the anonymous
  // browser session that built it, and must not be silently assigned to whichever account happens
  // to sign in next on the same device. This is a full replacement, never a merge — one account's
  // (or the guest's) in-progress cart must never bleed into another's.
  useEffect(() => {
    if (authLoading) return;
    const currentUserId = user?.id ?? null;
    if (lastAuthUserIdRef.current === currentUserId) return;
    lastAuthUserIdRef.current = currentUserId;

    const nextKey = currentUserId ? userCartStorageKey(currentUserId) : GUEST_CART_STORAGE_KEY;
    if (nextKey === cartStorageKeyRef.current) return;

    const nextCart = currentUserId ? loadPersistedCart(nextKey) : loadPersistedCart(GUEST_CART_STORAGE_KEY);

    cartStorageKeyRef.current = nextKey;
    dispatch({ type: 'LOAD_CART', cart: nextCart });
  }, [authLoading, user]);

  // Wait for the live catalog before pruning: revalidating against the still-empty initial state
  // would drop every restored entry before the real catalog has even arrived. gearKinds is passed as null
  // until the (independent, no-mock-fallback) gear catalog fetch resolves, so a slow or errored
  // BYO catalog never wipes a restored Build Your Own selection before it's had a chance to load.
  useEffect(() => {
    if (!ready) return;
    dispatch({
      type: 'REVALIDATE_AGAINST_CATALOG',
      kits,
      items,
      gearKinds: gearCatalogState === 'ready' ? gearKinds : null,
    });
  }, [ready, kits, items, gearKinds, gearCatalogState]);

  useEffect(() => {
    persistCart(cartStorageKeyRef.current, cart);
  }, [cart]);

  const totals = useMemo<RentalTotals>(
    () => {
      // Scoped to only what's checked for checkout — an unchecked package or BYO item saved for
      // later must never inflate the amount the customer is about to be asked to pay.
      const selectedCart = filterCartToSelection(cart);
      return {
        rentalDurationDays: calculateRentalDurationDays(cart.tripDetails),
        dueToday: calculateDueToday(selectedCart),
        dueBeforeStart: calculateDueBeforeStart(selectedCart),
      };
    },
    [cart],
  );

  const value = useMemo<RentalContextValue>(
    () => ({
      cart,
      dispatch,
      totals,
      addKit: (kit) => {
        // The actual enforcement point for "must be logged in to add to cart" — every UI entry
        // point (PathACatalog, PathBCatalog, GearDetailsModal) already checks `user` itself for a
        // friendly redirect, but this is the backstop a button can't be bypassed around: calling
        // this function directly (e.g. from devtools) while signed out is still refused here.
        if (!user) return false;
        // Same backstop reasoning as the auth check above, for RMS's own `canSelect` (surfaced here
        // as kit.isOutOfStock — see PackageKit.isOutOfStock's own doc comment). PathACatalog already
        // hides/disables the "Book Now" action for an out-of-stock kit or edition, but this is the
        // real enforcement point a caller can't be bypassed around. This is still only the advisory
        // catalog-level signal, never a security boundary on its own — the authoritative, date-aware
        // check is the fresh availability re-check PaymentBreakdown's own submit gate performs right
        // before booking creation, which this can never substitute for.
        if (!checkKitAvailability(kit, null)) return false;
        dispatch({ type: 'ADD_KIT', kit });
        return true;
      },
      removeKit: (kitId) => dispatch({ type: 'REMOVE_KIT', kitId }),
      addKitExtra: (kitId, extraId) => {
        if (!user) return false;
        dispatch({ type: 'ADD_KIT_EXTRA', kitId, extraId });
        return true;
      },
      removeKitExtra: (kitId, extraId) => dispatch({ type: 'REMOVE_KIT_EXTRA', kitId, extraId }),
      addItem: (item) => {
        if (!user) return false;
        dispatch({ type: 'ADD_ITEM', item });
        return true;
      },
      removeItem: (itemId) => dispatch({ type: 'REMOVE_ITEM', itemId }),
      addItemExtra: (itemId, extraId) => {
        if (!user) return false;
        dispatch({ type: 'ADD_ITEM_EXTRA', itemId, extraId });
        return true;
      },
      removeItemExtra: (itemId, extraId) => dispatch({ type: 'REMOVE_ITEM_EXTRA', itemId, extraId }),
      setByoGearQuantity: (gear, quantity) => {
        // Only an increase needs a signed-in customer — lowering an existing selection (including
        // down to 0, i.e. removal) is never blocked, same as every other removal path here.
        const current = cart.byoGears.find((g) => byoGearKey(g) === byoGearKey(gear))?.quantity ?? 0;
        if (quantity > current && !user) return false;
        dispatch({ type: 'SET_BYO_GEAR_QUANTITY', gear, quantity });
        return true;
      },
      setByoAddOnQuantity: (gearKey, addOn, quantity) => {
        const current = (cart.byoAddOns[gearKey] ?? []).find((a) => byoGearKey(a) === byoGearKey(addOn))?.quantity ?? 0;
        if (quantity > current && !user) return false;
        dispatch({ type: 'SET_BYO_ADDON_QUANTITY', gearKey, addOn, quantity });
        return true;
      },
      setPackageAddOnQuantity: (kitId, gear, quantity) => {
        const current =
          (cart.packageAddOns[kitId] ?? []).find((g) => byoGearKey(g) === byoGearKey(gear))?.quantity ?? 0;
        if (quantity > current && !user) return false;
        dispatch({ type: 'SET_PACKAGE_ADDON_QUANTITY', kitId, gear, quantity });
        return true;
      },
      updateTripDetails: (details) => dispatch({ type: 'UPDATE_TRIP_DETAILS', details }),
      updateVerificationDocs: (docs) => dispatch({ type: 'UPDATE_VERIFICATION_DOCS', docs }),
      toggleKitSelected: (kitId) => dispatch({ type: 'TOGGLE_KIT_SELECTED', kitId }),
      toggleItemSelected: (itemId) => dispatch({ type: 'TOGGLE_ITEM_SELECTED', itemId }),
      toggleByoGearSelected: (gearKey) => dispatch({ type: 'TOGGLE_BYO_GEAR_SELECTED', gearKey }),
      togglePackageAddOnSelected: (kitId, addOnKey) =>
        dispatch({ type: 'TOGGLE_PACKAGE_ADDON_SELECTED', kitId, addOnKey }),
      toggleByoAddOnSelected: (gearKey, addOnKey) => dispatch({ type: 'TOGGLE_BYO_ADDON_SELECTED', gearKey, addOnKey }),
      setAllCheckoutSelected: (selected) => dispatch({ type: 'SET_ALL_CHECKOUT_SELECTED', selected }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),
      dismissRemovedNotice: () => dispatch({ type: 'DISMISS_REMOVED_NOTICE' }),
    }),
    [cart, totals, user],
  );

  return <RentalContext.Provider value={value}>{children}</RentalContext.Provider>;
}

export function useRental(): RentalContextValue {
  const context = useContext(RentalContext);
  if (!context) {
    throw new Error('useRental must be used within a RentalProvider');
  }
  return context;
}
