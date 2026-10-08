/**
 * Every customer-facing promo string, in one place so marketing can change the wording without
 * touching any logic. Placeholders: `offer` is "15%" or "₱300" (built from the live promo, never
 * hardcoded), amounts are already formatted pesos. Rule: no em dashes in customer copy.
 */
export const PROMO_COPY = {
  seeTerms: 'See terms',
  /** Shown next to "See terms" under the homepage popup, and wherever a promo has no dates to state. */
  termsApply: 'Terms and conditions apply.',
  termsTitle: 'Offer terms',
  termsDefault: 'One discount per customer, first rental only. Your final total is confirmed when your booking is reviewed.',
  termsClose: 'Close',

  // Build Your Own progress bar
  progressEmpty: (offer: string) => `Add gear below to start unlocking your ${offer} first\u2011rental discount.`,
  progressEmptyEveryone: (offer: string) => `Add gear below to start unlocking your ${offer} discount.`,
  progressBelow: (remaining: string, offer: string) => `Add ${remaining} more to unlock your ${offer}.`,
  progressCount: (current: string, minimum: string) => `${current} of ${minimum} minimum`,
  progressUnlocked: (saving: string) => `Discount unlocked, you're saving ${saving} on this order.`,
  gearCardNote: (offer: string, minimum: string) => `${offer} off your order once it reaches ${minimum}`,
  gearCardNoteNoMinimum: (offer: string) => `${offer} off, applied automatically`,

  /** Shown to signed-out visitors next to the discount, linking to sign-up. */
  claimLink: 'Create a free account to claim it',
  claimReason: 'Create a free account to claim your first-rental discount.',

  /** The green "✓ You save ₱X (15%)" line on a discounted gear or package card. */
  youSave: (amount: string, percent: string | null) => (percent ? `You save ${amount} (${percent})` : `You save ${amount}`),

  /** Small badge beside a discounted price: "15% OFF" / "₱300 OFF". */
  offBadge: (offer: string) => `${offer} OFF`,

  // Package cards
  // Non-breaking hyphen (U+2011) so a narrow card wraps as "15% for / first-time renters", never "first- / time".
  packageTag: (offer: string) => `${offer} for first\u2011time renters`,
  packageTagEveryone: (offer: string) => `${offer} off`,

  // Cart and checkout
  discountLine: 'First-rental discount',
  discountLineEveryone: 'Discount',
  rentalFeeBeforeDiscount: 'Rental Fee (before discount)',
  rentalFeeAfterDiscount: 'Rental Fee Due',
  outsideWindow: (window: string) => `This offer covers ${window}.`,
  belowMinimum: (remaining: string, offer: string) => `Add ${remaining} more of qualifying gear to unlock your ${offer} discount.`,

  // Checkout "You saved" line (from the RMS quote)
  youSaved: (amount: string) => `You saved ${amount} on this booking`,
  youdSaveSignIn: (amount: string) => `You'd save ${amount} as a first-time renter. Sign in to confirm.`,
  addMoreToUnlock: (remaining: string) => `Add ${remaining} more to unlock your discount`,
  backToCatalog: 'Back to the catalog',
  estimatedSaving: (amount: string) => `Estimated saving: ${amount}`,
  estimatedSavingNote: 'Estimated saving, confirmed when your booking is reviewed.',

  // After booking / My Bookings
  savedOnBooking: (amount: string, label: string) => `You saved ${amount} (${label})`,
} as const;
