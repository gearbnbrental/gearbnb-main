import type { PaymentMethodKind } from '../utils/rmsApi';

/**
 * Client-provided payment method details, shown to the customer in DepositProofUpload's payment
 * instructions (security deposit). This is the ONLY place these values should live — do not
 * hard-code any of them directly inside a component.
 */
export interface PaymentMethodConfig {
  id: string;
  /** Display name shown to the customer, e.g. "GCash". */
  name: string;
  /** Path/URL to the QR code image, or null while no real QR image has been provided yet. */
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
  /** Which RMS PaymentMethod value this option is recorded as when a customer selects it on the
   * proof-submission form. RMS has no dedicated "MariBank" value, so a MariBank transfer is
   * recorded as BANK_TRANSFER — confirmed against prisma/schema.prisma's PaymentMethod enum. */
  rmsMethod: PaymentMethodKind;
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
  },
];
