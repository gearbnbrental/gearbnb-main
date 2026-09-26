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

/**
 * A color/material variant of a kit. Each edition is its own distinct real RMS `Package` row (own
 * `packageNumber`, own price/deposit columns) — NOT guaranteed to share the parent kit's pricing;
 * two editions of the same kit (e.g. Black vs Khaki) can be priced differently in RMS. `pricing`/
 * `depositAmount`/`extraPerDayPrice`/`isOutOfStock` are this edition's own values, resolved from
 * its own row — never inherited from whichever edition happens to be first/`primary` in
 * groupPackageRows. Once a customer actually selects an edition, these are what must be displayed
 * and charged, not the parent PackageKit's own fields (which only ever reflect the first edition).
 */
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
  /** This edition's own fixed price tiers — see this interface's own doc comment on why this can
   *  differ from the parent kit's `pricing`. */
  pricing: {
    '48h': number;
    '72h': number;
  };
  /** This edition's own refundable deposit in PHP. */
  depositAmount: number;
  /** This edition's own authoritative per-extra-day rate — see `PackageKit.extraPerDayPrice`. */
  extraPerDayPrice?: number;
  /** This edition's OWN description — each edition is a distinct real Package row with its own
   *  `description` column, so a Black and a Khaki edition can read completely differently (not
   *  just a different photo/price). Never borrowed from the primary/first entry. */
  description: string;
  /**
   * True when RMS reports this specific edition as currently unselectable (its own component
   * stock, via the RMS catalog's `canSelect` — see `PackageKit.isOutOfStock`'s own doc comment).
   * Two editions of the same kit can disagree (Black in stock, Khaki isn't).
   */
  isOutOfStock?: boolean;
  /** This edition's OWN real component list — see PackageKit.components' own doc comment. */
  components?: PackageComponent[];
  /** This edition's OWN real photo gallery — see PackageKit.images' own doc comment. */
  images?: string[];
}

/**
 * One real, structured line of what a package actually includes — the RMS's own
 * category+brand+model+quantity for a required component, resolved against its live inventory
 * (never a client-side guess). This is deliberately NOT the same thing as `PackageKit.description`
 * sometimes being typed as a run-on inclusions list (see parsePackageContentsFromText) — that's a
 * best-effort GUESS at structure inside free text; this is the RMS's own real answer, and is what
 * lets a "What's Included" row safely link to that component's own real product details (see
 * matchComponentToGearKind) — a text guess never could, reliably.
 */
export interface PackageComponent {
  category: string;
  brand: string;
  model: string | null;
  /** Null on the rare component whose kind has no current live-priced inventory at all. */
  name: string | null;
  /** The color the package's unit is ("Black"/"Khaki"), or null when it isn't color-specific. */
  color?: string | null;
  quantity: number;
  availableCount: number;
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
   * True when RMS's own catalog `canSelect` signal (GET /api/customer/catalog/packages — see
   * RmsCatalogPackage.canSelect's own doc comment) reports this package as currently unselectable
   * — a required component's live stock can't cover it, by RMS's own current-snapshot check.
   * Distinct from `unavailableRanges`, which is date-specific. Per client rule: still shown in the
   * catalog, just marked "Out of Stock" and not addable to cart (see checkKitAvailability). For a
   * kit with editions, this reflects the first/primary edition only — see KitEdition's own
   * `isOutOfStock` for a specific edition's real status. Advisory only, same as RMS's own
   * `canSelect`: the authoritative, date-aware gate is the availability check re-run at submission.
   */
  isOutOfStock?: boolean;
  /** This kit's own real component list, from the RMS's package catalog (see PackageComponent's
   *  own doc comment) — absent until applyPackageSelectability's fetch resolves, same "advisory,
   *  filled in later" timing as isOutOfStock above. */
  components?: PackageComponent[];
  /** This kit's own real photo gallery, from the RMS's package catalog — absent for any package
   *  staff haven't uploaded extra photos for yet, in which case `imageUrl` alone (the one photo
   *  from Supabase) is still shown, exactly as before this existed. Same "filled in later" timing
   *  as `components` above. */
  images?: string[];
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
  /** The RMS's own staff-written note for this add-on (e.g. "2pcs Canopy Poles Per Set") — absent
   *  when nothing's been written yet. Same convention as BookableGearKind.description. */
  description?: string;
  imageUrl?: string | null;
  images?: string[];
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
  /** Present only when the RMS reports this kind's units in more than one color (Black, Khaki...).
   *  Everything above stays the kind-wide total/default. Absent on single-color/no-color kinds and
   *  on an RMS that doesn't send colors yet — the catalog then behaves exactly as before. */
  variants?: BookableGearVariant[];
  /** The RMS's free-text "Size / Capacity" for this kind (e.g. "6P", "King"), shown on the card
   *  when present. Absent when the RMS has none or doesn't send it yet. */
  sizeCapacity?: string | null;
  /** The one color of a single-color kind, when the RMS reports it (e.g. a table that only exists in
   *  Khaki). Used only to filter by the page's color switch — never part of the cart line's
   *  identity or the booking payload (unlike `color`, which is set on a resolved variant). */
  kindColor?: string;
  /** The RMS's own staff-written description for this kind (or, on a resolved color, that color's
   *  own description — see resolveGearVariant) — absent when nothing has been written yet. Never
   *  shown as a fallback for anything; an absent description just means the details view has none
   *  to show. */
  description?: string;
  /** Every "in person" photo of this kind (or, on a resolved color, that color's own set) — the
   *  gallery a details view shows, in RMS order. `imageUrl` above stays the one default/card photo
   *  either way. Absent/empty when the RMS has none beyond the default. */
  images?: string[];
  /** Set only on a kind resolved to ONE color variant (see resolveGearVariant) — the shape that
   *  actually goes into the cart and the booking/availability payloads. `variants` is never set
   *  on such a kind. */
  color?: string;
}

/** One color of a Build Your Own gear kind, as reported by the RMS. `pricing`/`extraPerDayPrice`
 *  are present only when this color's price differs from the kind's own. */
export interface BookableGearVariant {
  color: string;
  imageUrl: string | null;
  quantity: number;
  availableCount: number;
  canSelect: boolean;
  pricing?: { '48h': number; '72h': number };
  extraPerDayPrice?: number;
  /** Only when this color's size/capacity differs from the kind's own. */
  sizeCapacity?: string | null;
  /** This color's OWN description — never the kind's or another color's (Black and Khaki of the
   *  same kind can read completely differently). */
  description?: string;
  /** This color's OWN gallery — never shared with another color. */
  images?: string[];
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
  /** Selected package add-on keys (byoGearKey(gear)), one array per parent kit id — the same
   *  include/exclude-from-checkout granularity as kitIds, one level down. An add-on can be excluded
   *  from checkout on its own, independent of its parent kit or any of that kit's other add-ons.
   *  Only meaningful for a kitId also present in kitIds. */
  packageAddOnKeys: Record<string, string[]>;
  /** Selected BYO add-on keys (byoGearKey(addOn)), one array per parent BYO gear's byoGearKey —
   *  mirrors packageAddOnKeys, one level down from byoGearKeys. */
  byoAddOnKeys: Record<string, string[]>;
}

/** The full shape of the shopping cart / booking flow state. */
export interface CartState {
  selectedKits: PackageKit[];
  /** Selected KitExtra ids per kit id, for kits chosen via Path A. */
  kitExtras: Record<string, string[]>;
  /** Optional EXTRA rentable inventory a customer added on top of a selected package, keyed by
   *  that kit's cart id. These are ordinary gear kinds from the same live Build Your Own catalog
   *  (`BookableGearSelection`, identical to `byoGears`) — not package contents, and not the
   *  GearPairing-based `BookableAddOn` mechanism that `byoAddOns` uses. They are submitted to the
   *  RMS as `bookingGears[]` alongside `packageCode`, which the RMS validates, prices and reserves
   *  as real inventory. Kept separate from `byoGears` so a package booking never reads as a Build
   *  Your Own one: the package stays a package, these ride along with it. */
  packageAddOns: Record<string, BookableGearSelection[]>;
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
