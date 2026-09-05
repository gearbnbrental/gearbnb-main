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
}

/** A bundled equipment package (e.g. "Nomad Kit") available for rent. */
export interface PackageKit {
  id: string;
  name: string;
  description: string;
  /** Refundable deposit in PHP, e.g. 400 for ₱400. */
  depositAmount: number;
  /** Fixed price tiers — real kits are only bookable at these two durations. */
  pricing: {
    '48h': number;
    '72h': number;
  };
  includedItems: string[];
  /** Display range, e.g. "1–2 Pax". */
  paxRange: string;
  /** Max group size this kit comfortably serves; drives Path A's Group Size filter. */
  capacity: number;
  /** Default/representative product image. */
  imageUrl: string;
  /** Present only for kits sold in more than one color/edition (e.g. Nomad, Base Camper). */
  editions?: KitEdition[];
  /** Mock blackout windows pending real RMS inventory/availability integration. */
  unavailableRanges?: DateRange[];
  /** Optional duration-gated add-ons for this kit. */
  extras?: KitExtra[];
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
}

/** A pickup/delivery location a booking can be scheduled to (admin-managed list). */
export interface Destination {
  id: string;
  name: string;
}

export type FulfillmentType = 'delivery' | 'pickup';

/** Trip scheduling and fulfillment preferences for a booking. */
export interface TripDetails {
  startDate: string;
  returnDate: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  preferredTime: string;
}

/** Customer identity verification documents required before checkout. */
export interface VerificationDocs {
  fullName: string;
  phone: string;
  email: string;
  idType1: string;
  idType2: string;
  /** Object URL of a short spoken-verification video (holding ID, stating name + today's date). */
  verificationVideo: string;
  proofOfBilling: string;
}

/** The full shape of the shopping cart / booking flow state. */
export interface CartState {
  selectedKits: PackageKit[];
  /** Selected KitExtra ids per kit id, for kits chosen via Path A. */
  kitExtras: Record<string, string[]>;
  selectedItems: IndividualItem[];
  tripDetails: TripDetails;
  verificationDocs: VerificationDocs;
}
