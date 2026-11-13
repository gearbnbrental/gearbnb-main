/**
 * The facts AI agents get asked about GearBnB, as plain text: how renting works, the security
 * deposit and how to reach us. /llms.txt (src/agentFiles.ts) and the in-browser agent tools
 * (src/utils/webMcp.ts) both use these, so they always agree with each other and with the deposit
 * rule itself.
 */
import { DEPOSIT_TIERS, TOP_TIER_DEPOSIT_CENTAVOS } from '../utils/securityDeposit';
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, MESSENGER_URL } from './social';

export const BUSINESS_SUMMARY =
  'Camping gear rental in Las Piñas City, Metro Manila, Philippines. Rent a complete camping package or individual gear (tents, beds, chairs, tables, coolers, fans, lights) for 48 or 72 hours, with pickup in Las Piñas or Grab delivery. Book online at gearbnbrental.com.';

export const HOW_RENTING_WORKS = [
  'Choose a camping package or build your own setup piece by piece, then pick 48 hours, 72 hours, or 72 hours plus extra days.',
  'Check out online with identity verification: two government IDs, a short video holding your ID, and a proof of billing.',
  'Pay the security deposit within 24 hours of checking out, while GearBnB reviews the documents. Unpaid bookings are cancelled automatically and the gear released.',
  "The deposit is refunded in full if a booking isn't approved; after approval, refunds follow the rental agreement.",
  'Pay the rental fee on or before the rental date. Pick up in Las Piñas City or book Grab delivery (paid by the renter).',
  'Payment is by GCash or bank transfer.',
];

export const DEPOSIT_RULE =
  'A package on its own has its own deposit. Build Your Own, and a package whose add-ons bring the rental total (before discounts) into a higher tier, pay by rental total:';

const peso = (centavos: number) => `₱${(centavos / 100).toLocaleString('en-PH')}`;

/** "Rental total below ₱1,000: ₱300 deposit", ... from the one deposit rule. */
export function depositTierLines(): string[] {
  let from = 0;
  const lines = DEPOSIT_TIERS.map((tier) => {
    const range =
      from === 0 ? `below ${peso(tier.upToCentavos)}` : `${peso(from)} to ${tier.inclusive ? '' : 'below '}${peso(tier.upToCentavos)}`;
    from = tier.upToCentavos;
    return `Rental total ${range}: ${peso(tier.depositCentavos)} deposit`;
  });
  lines.push(`Rental total above ${peso(from)}: ${peso(TOP_TIER_DEPOSIT_CENTAVOS)} deposit`);
  return lines;
}

export const CONTACT_FACTS = [
  `Phone: ${CONTACT_PHONE_DISPLAY}`,
  ...(CONTACT_EMAIL ? [`Email: ${CONTACT_EMAIL}`] : []),
  `Messenger: ${MESSENGER_URL}`,
  'Location: Talon Uno, Las Piñas City, Metro Manila, Philippines (exact pickup address shared once a booking is confirmed)',
];
