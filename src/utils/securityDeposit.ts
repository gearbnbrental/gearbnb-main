/**
 * The security deposit rule. The RMS applies the same rule when the booking is created and its
 * figure is the one the renter pays; this copy lets the catalog, cart and checkout show the amount
 * before the booking exists. Keep the two in step (RMS: src/domain/securityDeposit.ts).
 *
 * Tiers, by the rental total for gear and add-ons BEFORE any promo discount:
 *   below ₱1,000            → ₱300
 *   ₱1,000 to below ₱4,000  → ₱500
 *   ₱4,000 to ₱6,000        → ₱900   (₱4,000 and ₱6,000 both included)
 *   above ₱6,000            → ₱1,200
 *
 * Build Your Own pays the tier. A package on its own pays the package's own deposit. A package
 * with extra gear pays whichever is higher: its own deposit or the tier for the whole total.
 */

export const DEPOSIT_TIERS: ReadonlyArray<{ upToCentavos: number; inclusive: boolean; depositCentavos: number }> = [
  { upToCentavos: 100_000, inclusive: false, depositCentavos: 30_000 },
  { upToCentavos: 400_000, inclusive: false, depositCentavos: 50_000 },
  { upToCentavos: 600_000, inclusive: true, depositCentavos: 90_000 },
];
export const TOP_TIER_DEPOSIT_CENTAVOS = 120_000;

/** The tier deposit for a rental total (both in centavos). */
export function depositTierCentavos(rentalCentavos: number): number {
  for (const tier of DEPOSIT_TIERS) {
    if (tier.inclusive ? rentalCentavos <= tier.upToCentavos : rentalCentavos < tier.upToCentavos) {
      return tier.depositCentavos;
    }
  }
  return TOP_TIER_DEPOSIT_CENTAVOS;
}

/** Why the deposit is what it is: the package's own amount, or the tier for the rental total. */
export type DepositReason = 'PACKAGE' | 'TIER';

export interface DepositInput {
  /** The package's own deposit, or null for Build Your Own. */
  packageDepositCentavos: number | null;
  /** True when extra gear or add-ons were added to the package. Ignored for Build Your Own. */
  hasExtras: boolean;
  /** Gear and add-ons, before any promo discount. */
  rentalBeforePromoCentavos: number;
}

export function requiredDeposit(input: DepositInput): { depositCentavos: number; reason: DepositReason } {
  const tier = depositTierCentavos(input.rentalBeforePromoCentavos);
  if (input.packageDepositCentavos === null) return { depositCentavos: tier, reason: 'TIER' };
  if (!input.hasExtras || input.packageDepositCentavos >= tier) {
    return { depositCentavos: input.packageDepositCentavos, reason: 'PACKAGE' };
  }
  return { depositCentavos: tier, reason: 'TIER' };
}

/** "for rentals above ₱6,000" — the tier a total falls in, in words, for the deposit explanation. */
export function depositTierLabel(rentalCentavos: number): string {
  if (rentalCentavos < 100_000) return 'for rentals below ₱1,000';
  if (rentalCentavos < 400_000) return 'for rentals from ₱1,000 to below ₱4,000';
  if (rentalCentavos <= 600_000) return 'for rentals from ₱4,000 to ₱6,000';
  return 'for rentals above ₱6,000';
}

const peso = (centavos: number) => `₱${(centavos / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

/**
 * One line explaining the deposit, or null when there's nothing to explain (a package's own
 * deposit). Amounts in centavos.
 *   Build Your Own: "₱900 deposit for rentals from ₱4,000 to ₱6,000 (your rental: ₱4,200)."
 *   Package raised by its extras: "Your add-ons bring the rental to ₱7,000, so the deposit is ₱1,200 instead of the package's ₱500."
 */
export function depositExplanation(input: {
  depositCentavos: number;
  reason: DepositReason | null;
  /** The package's own deposit, or null for Build Your Own. */
  packageDepositCentavos: number | null;
  rentalBeforePromoCentavos: number;
}): string | null {
  if (input.reason !== 'TIER' || input.depositCentavos <= 0) return null;
  if (input.packageDepositCentavos !== null) {
    return `Your add-ons bring the rental to ${peso(input.rentalBeforePromoCentavos)}, so the deposit is ${peso(input.depositCentavos)} instead of the package's ${peso(input.packageDepositCentavos)}.`;
  }
  return `${peso(input.depositCentavos)} deposit ${depositTierLabel(input.rentalBeforePromoCentavos)} (your rental: ${peso(input.rentalBeforePromoCentavos)}).`;
}
