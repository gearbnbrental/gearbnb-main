/**
 * Root-relative URLs to the client's official legal PDFs (public/legal/) — the ONLY place these
 * paths should be written; do not hardcode a legal-document URL directly inside a component.
 * These are the exact, unedited, client-provided files as saved into public/legal/ — never
 * rewritten, summarized, or replaced by this codebase. Filenames are exactly as provided;
 * encodeURI escapes the space characters (leaving '&' as-is, which is valid unencoded in a path).
 */
export const TERMS_AND_CONDITIONS_URL = encodeURI('/legal/GearBnB Kit T&C Rental Agreement.pdf');

/** Applies only to Build Your Own bookings — see isByoBooking in VerificationUpload.tsx/PaymentBreakdown.tsx. */
export const BYO_RENTAL_AGREEMENT_URL = encodeURI('/legal/GearBnB BYO T&C Rental Agreement.pdf');
