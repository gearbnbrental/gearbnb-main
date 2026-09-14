/** A rental duration preset offered on Path A's filter bar and Path B's duration gate. */
export type DurationPresetId = '24h' | '48h' | '72h';

/** An inclusive date range, ISO date strings (yyyy-mm-dd). */
export interface DateRange {
  start: string;
  end: string;
}

/** An optional add-on for a package kit, unlocked once the trip duration meets minDurationHours. */
export interface KitExtra {
  id: string;
  name: string;
  /** One-time fee in PHP, added to the rental fee total (no separate deposit). */
  price: number;
  /** 0 means available at any duration (e.g. the Plus Kit cooking upgrade). */
  minDurationHours: number;
  imageUrl?: string;
}

/** A color/material variant of a kit that shares the same price and inclusions. */
export interface KitEdition {
  id: string;
  label: string;
  imageUrl: string;
  /**
   * The RMS's own Package.packageNumber (e.g. "PKG-0003") for this specific edition — each
   * edition is a distinct real Package row, so each carries its own number. Required at booking
   * submission; the RMS customer API identifies packages by this, not by the Supabase row id.
   */
  packageNumber: string;
}

/** A bundled equipment package (e.g. "Nomad Kit") available for rent. */
export interface PackageKit {
  id: string;
  name: string;
  description: string;
  /** The RMS's own Package.packageNumber — see KitEdition.packageNumber for why this exists
   * separately from `id`. For a kit with editions, this is the first edition's number; the
   * specific edition actually selected is what's actually submitted. */
  packageNumber: string;
  /** Refundable deposit in PHP, e.g. 400 for ₱400. */
  depositAmount: number;
  /** Fixed price tiers — real kits are only bookable at these two durations. */
  pricing: {
    '48h': number;
    '72h': number;
  };
  /** Authoritative per-extra-day rate beyond the 72h tier, from the RMS's own
   *  `Package.extraPerDayCentavos` column — same convention as
   *  `BookableGearKind.extraPerDayPrice`. Optional and defaults to 0 (never charging for extra
   *  days) so a package the admin hasn't configured a rate for yet — or mock/fallback data — never
   *  invents a price; see getKitPrice. */
  extraPerDayPrice?: number;
  includedItems: string[];
  /** Display range, e.g. "1–2 Pax". */
  paxRange: string;
  /** Max group size this kit comfortably serves; shown on Path A when known. Real Package rows
   *  currently have no capacity column (always 0/unknown here) — see Path A's own "Number of
   *  Guests" filter, which treats an unknown capacity as "could fit" rather than excluding it. */
  capacity: number;
  /** Default/representative product image. */
  imageUrl: string;
  /** Present only for kits sold in more than one color/edition (e.g. Nomad, Base Camper). */
  editions?: KitEdition[];
  /** Mock blackout windows pending real RMS inventory/availability integration. */
  unavailableRanges?: DateRange[];
  /** Optional duration-gated add-ons for this kit. */
  extras?: KitExtra[];
  /**
   * True when this kit is permanently unbookable regardless of selected dates (e.g. a required
   * component is out of stock) — distinct from `unavailableRanges`, which is date-specific. Per
   * client rule: still shown in the catalog, just marked "Out of Stock" and not addable to cart.
   * The real `Package` schema has no such column yet; this is a backend/schema requirement, not
   * something this frontend can compute on its own.
   */
  isOutOfStock?: boolean;
}

/** A single piece of gear that can be rented on its own. */
export interface IndividualItem {
  id: string;
  name: string;
  category: string;
  /** Fixed price tiers — real gear (RentableGear) has no daily-rate field, only 48h/72h. */
  pricing: {
    '48h': number;
    '72h': number;
  };
  depositAmount: number;
  imageUrl: string;
  /** Mock blackout windows pending real RMS inventory/availability integration. */
  unavailableRanges?: DateRange[];
  /**
   * True when this item is permanently unbookable regardless of selected dates (out of stock).
   * Same backend/schema gap as `PackageKit.isOutOfStock` — `RentableGear` has no column for this
   * yet on the real schema.
   */
  isOutOfStock?: boolean;
  /**
   * Internal inventory brand (e.g. "Generic") — never rendered on the customer-facing site per
   * client rule. Kept only so mock data mirrors the real schema's brand column; display name
   * must already read clean (see `stripGenericBrand` in supabaseCatalog.ts for the same rule
   * applied to real Supabase rows, whose `name` column may still contain "Generic ...").
   */
  brand?: string;
  /**
   * Free accessories bundled with this item, shown only as a marketing/value signal (e.g.
   * "🎁 Free use of Groundsheet") — never billed separately. `RentableGear` has no relation to
   * model this yet; it's a backend/schema requirement, kept as a plain string list here.
   */
  includedAccessories?: string[];
  /** Optional paid add-ons for this item when rented via Path B (e.g. Extra Canopy Poles). */
  paidAddOns?: KitExtra[];
}

/** One free accessory bundled at no charge with a Build Your Own gear kind (e.g. a tent's
 * groundsheet) — informational only, never billed, never itself a selectable catalog entry.
 * Mirrors the RMS's CustomerCatalogGearKind.freeAccessories exactly. */
export interface FreeAccessory {
  role: string;
  name: string;
}

/** One paid add-on the RMS has confirmed is compatible with a specific Build Your Own gear kind
 * (e.g. an Extra Canopy Pole Set for the Vidalido Vicore Tent) — resolved server-side from real
 * GearPairing data, never special-cased by brand/name in this frontend. Mirrors the RMS's
 * CustomerCatalogAddOn exactly. `maxQuantity` is the real, pairing-specific cap (e.g. 2 sets),
 * never a hardcoded literal. */
export interface BookableAddOn {
  role: string;
  category: string;
  brand: string;
  model: string | null;
  name: string;
  pricing: { '48h': number; '72h': number };
  extraPerDayPrice: number;
  maxQuantity: number;
  availableCount: number;
}

/** One selectable Build Your Own gear kind, sourced entirely from the RMS's live inventory
 * (GET /api/customer/catalog/gear) — mirrors the RMS's CustomerCatalogGearKind exactly. Unlike
 * PackageKit/IndividualItem, there is no client-side id: the RMS identifies a kind by its
 * category+brand+model triple (see byoGearKey in RentalContext.tsx), and that same triple is
 * what gets submitted in the booking payload. */
export interface BookableGearKind {
  category: string;
  brand: string;
  model: string | null;
  name: string;
  pricing: { '48h': number; '72h': number };
  extraPerDayPrice: number;
  /** Total real units of this kind that exist, regardless of current availability. */
  quantity: number;
  /** How many units are actually available right now — the UI's real cap, not `quantity`. */
  availableCount: number;
  /** False when availableCount is 0 — RMS's own signal for whether this kind can be selected. */
  canSelect: boolean;
  imageUrl: string | null;
  freeAccessories: FreeAccessory[];
  compatibleAddOns: BookableAddOn[];
}

/** A customer's selected quantity of one Build Your Own gear kind — the full kind snapshot plus
 * `quantity`, mirroring how `selectedKits`/`selectedItems` already store their full catalog
 * object rather than just an id. Selected add-ons for this gear live separately in
 * `CartState.byoAddOns`, keyed the same way `kitExtras`/`itemExtras` key off their parent's id. */
export interface BookableGearSelection extends BookableGearKind {
  quantity: number;
}

/** A customer's selected quantity of one add-on compatible with a specific selected gear kind. */
export interface BookableAddOnSelection extends BookableAddOn {
  quantity: number;
}

export type FulfillmentType = 'delivery' | 'pickup';

/** Trip scheduling and fulfillment preferences for a booking. */
export interface TripDetails {
  startDate: string;
  returnDate: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  preferredTime: string;
  /**
   * Free-text destination/venue. The RMS's Booking.destinationId is NOT NULL — this is the
   * minimum field needed to satisfy that constraint. This is deliberately NOT a reintroduction of
   * the destination *picker* (a dropdown backed by the `destinations` table) that was removed
   * earlier; it's a plain text field, added only because booking submission is otherwise
   * impossible against the real schema.
   */
  destination: string;
}

/** The verification slots the checkout requires. Slot *contents* are deliberately untyped as to
 * artifact kind — whether the face-verification slot takes a video or a selfie is still an open
 * product question, and nothing in the gate logic depends on the answer. */
export type VerificationDocumentKey = 'idType1' | 'idType2' | 'verificationVideo' | 'proofOfBilling';

/**
 * Describes a file the customer has selected and (once storagePath is set) successfully uploaded
 * to the private verification-documents bucket. Deliberately holds no blob/object URL: those are
 * tab-scoped, are revoked when the upload form unmounts, and would misrepresent a dead reference
 * as a stored file. `storagePath` is null while a file is selected but upload hasn't succeeded
 * yet (in flight, or failed) — the submission gate requires it to be non-null.
 */
export interface VerificationFileMeta {
  name: string;
  size: number;
  type: string;
  storagePath: string | null;
}

/** Customer identity verification state captured during checkout. */
export interface VerificationDocs {
  fullName: string;
  phone: string;
  email: string;
  /** Per-slot metadata for selected files; null means the slot is still empty. */
  documents: Record<VerificationDocumentKey, VerificationFileMeta | null>;
  termsAccepted: boolean;
  /** Required only for a Build Your Own booking (see isByoBooking in VerificationUpload.tsx) —
   * ignored by isVerificationComplete for a package booking, same as the BYO Rental Agreement
   * checkbox itself only being shown for a BYO booking. */
  byoAgreementAccepted: boolean;
  /** Set when the customer completes the Identity Verification section; cleared by any later edit. */
  confirmed: boolean;
}

/** Which cart entries the customer wants included in the *next* checkout. The RMS accepts only
 * one package or one Build Your Own selection per booking submission, but the cart itself can
 * hold more than one valid combination at once (e.g. two packages, or a package plus a BYO
 * selection, added across separate browsing sessions). This lets the customer narrow that down
 * to exactly one via checkboxes on the Cart page, without deleting the rest — everything newly
 * added to the cart defaults to selected. */
export interface CheckoutSelection {
  kitIds: string[];
  itemIds: string[];
  byoGearKeys: string[];
}

/** The full shape of the shopping cart / booking flow state. */
export interface CartState {
  selectedKits: PackageKit[];
  /** Selected KitExtra ids per kit id, for kits chosen via Path A. */
  kitExtras: Record<string, string[]>;
  selectedItems: IndividualItem[];
  /** Selected paid add-on ids per item id, for individual gear chosen via Path B. */
  itemExtras: Record<string, string[]>;
  /** Build Your Own gear selections, sourced from the RMS gear catalog — see BookableGearSelection. */
  byoGears: BookableGearSelection[];
  /** Selected add-ons per BYO gear, keyed by that gear's byoGearKey — mirrors kitExtras/itemExtras. */
  byoAddOns: Record<string, BookableAddOnSelection[]>;
  tripDetails: TripDetails;
  verificationDocs: VerificationDocs;
  checkoutSelection: CheckoutSelection;
  /** Names of cart entries just dropped by REVALIDATE_AGAINST_CATALOG because they no longer exist
   * in the live catalog (e.g. deactivated by an admin) — shown once as a dismissible notice on the
   * Cart page so a removal is never silent. Deliberately not persisted to localStorage (excluded
   * from PersistedCart): it's a one-time "this just happened" notice, not cart state. */
  removedItemNames: string[];
}
