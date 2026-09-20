import type { PaymentMethodKind } from '../utils/rmsApi';

/**
 * Client-provided payment method details, shown to the customer in PaymentInstructionsSection
 * (DepositProofUpload.tsx) — the one shared instructions block every payment-proof flow
 * (security deposit, rental fee, additional charge) reuses. This is the ONLY place these values
 * should live — do not hard-code any of them directly inside a component.
 */
export interface PaymentMethodConfig {
  id: string;
  /** Display name shown to the customer, e.g. "GCash". */
  name: string;
  /** Bundled placeholder QR image — no longer the primary source. The RMS Settings page's own
   * live-configured QR (GET /api/customer/payment-qr, exposed here as CatalogContext's
   * `paymentQr`) is authoritative; PaymentInstructionsSection only falls back to this local image
   * if that fetch genuinely fails, never merely because the live answer is "no QR configured
   * right now." Kept, rather than removed, exactly for that failure case — see its own comment at
   * the call site. */
  qrImageUrl: string | null;
  /** Alt text for the QR image — must stay descriptive even before a real image is set. */
  qrImageAlt: string;
  /** Name/label the account is registered under, exactly as shown on the client's QR image
   * (including any masking GCash/MariBank themselves apply, e.g. "MA***L V."). */
  accountName: string;
  /** What the number below is — e.g. "GCash Number", "MariBank Account Number". Kept per-method
   * because the two providers label their identifiers differently. */
  accountNumberLabel: string;
  /** The account/mobile number a customer sends payment to, as provided by the client. */
  accountNumber: string;
  /** Which RMS PaymentMethod value this option is recorded as on the Security Deposit and Rental
   * Fee proof-submission forms. For MariBank this stays BANK_TRANSFER — those two endpoints have
   * no dedicated MARIBANK value of their own; see additionalChargeRmsMethod below for the one
   * endpoint that does. */
  rmsMethod: PaymentMethodKind;
  /** Overrides `rmsMethod` for the Additional Charge proof-submission form only (see
   * AdditionalChargeProofDialog.tsx) — that endpoint now has a real, dedicated MARIBANK enum
   * value on the RMS side, unlike the older Security Deposit/Rental Fee endpoints above, which
   * still expect a MariBank transfer recorded as BANK_TRANSFER. Absent (falls back to
   * `rmsMethod`) for any method, like GCash, that isn't affected by this distinction. */
  additionalChargeRmsMethod?: PaymentMethodKind;
}

// Account names stay masked exactly as GCash/MariBank themselves print them ("MA***L V.") — never
// expanded to the full registered name. The account numbers are the client-provided destinations a
// customer must actually be able to read and type to pay, so those are shown in full.
export const PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: 'gcash',
    name: 'GCash',
    qrImageUrl: '/images/payment-qr/gcash-qr.png',
    qrImageAlt: 'GCash QR code for GearBnB payments',
    accountName: 'MA***L V.',
    accountNumberLabel: 'GCash Number',
    accountNumber: '09765952432',
    rmsMethod: 'GCASH',
  },
  {
    id: 'maribank',
    name: 'MariBank',
    qrImageUrl: '/images/payment-qr/maribank-qr.png',
    qrImageAlt: 'MariBank QR code for GearBnB payments',
    accountName: 'MA***L V.',
    accountNumberLabel: 'MariBank Account Number',
    accountNumber: '10917833891',
    rmsMethod: 'BANK_TRANSFER',
    additionalChargeRmsMethod: 'MARIBANK',
  },
];
