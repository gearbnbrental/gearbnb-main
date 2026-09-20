import { describe, expect, it } from 'vitest';
import {
  classifyMyBookingsLoadError,
  getBookingStatusLabel,
  getChargeProofState,
  getNextStep,
  getReturnOutcome,
  hasOutstandingPayment,
  isTerminalBooking,
} from './MyBookings';
import { RMS_NOT_CONFIGURED_CODE, RmsApiError, type RmsAdditionalCharge, type RmsMyBooking } from '../utils/rmsApi';

/**
 * Pins down the terminal-booking behaviour fixed in this pass: once a booking reaches COMPLETED or
 * CANCELLED (the RMS's own genuinely final statuses — confirmed against prisma/schema.prisma's
 * BookingStatus enum), no action banner, outstanding-payment count, or payment/document action is
 * ever offered for it again, while a non-terminal booking's existing behaviour is unaffected.
 */

function makeBooking(overrides: Partial<RmsMyBooking> = {}): RmsMyBooking {
  return {
    bookingId: 'b1',
    bookingNumber: 'GB-2026-0001-01',
    status: 'RESERVED',
    pickupAt: '2026-10-01T00:00:00.000Z',
    returnAt: '2026-10-03T00:00:00.000Z',
    rentalFeeCentavos: 100000,
    depositCentavos: 50000,
    securityDeposit: {
      requiredCentavos: 50000,
      verifiedCentavos: 0,
      verified: false,
      proofStatus: null,
      reviewNote: null,
      amountClaimedCentavos: null,
    },
    fulfillmentType: 'PICKUP',
    deliveryAddress: null,
    packages: [{ name: 'Camper Kit', quantity: 1 }],
    gears: [],
    addOns: [],
    verificationDocuments: [],
    ...overrides,
  };
}

function makeCharge(overrides: Partial<RmsAdditionalCharge> = {}): RmsAdditionalCharge {
  return {
    id: 'c1',
    chargeNumber: 'AC-0001',
    type: 'DAMAGE',
    itemName: 'Tent',
    quantity: 1,
    extraDays: null,
    reason: 'Torn fabric',
    amountCentavos: 20000,
    status: 'PENDING',
    createdAt: '2026-10-04T00:00:00.000Z',
    paymentProof: null,
    canSubmitPaymentProof: true,
    ...overrides,
  };
}

describe('isTerminalBooking', () => {
  it('treats COMPLETED and CANCELLED as terminal', () => {
    expect(isTerminalBooking(makeBooking({ status: 'COMPLETED' }))).toBe(true);
    expect(isTerminalBooking(makeBooking({ status: 'CANCELLED' }))).toBe(true);
  });

  it('does not treat RETURNED as terminal — a rental fee or additional charge can still be legitimately payable before RMS marks it COMPLETED', () => {
    expect(isTerminalBooking(makeBooking({ status: 'RETURNED' }))).toBe(false);
  });

  it('does not treat an active status as terminal', () => {
    for (const status of ['PENDING_REVIEW', 'AWAITING_CUSTOMER_RESPONSE', 'AWAITING_PAYMENT', 'RESERVED', 'READY_FOR_PICKUP', 'RENTED', 'OVERDUE_FOR_RETURN', 'PENDING_FOR_INSPECTION']) {
      expect(isTerminalBooking(makeBooking({ status }))).toBe(false);
    }
  });
});

describe('getNextStep — terminal bookings never show an actionable banner', () => {
  it('CANCELLED never shows the correction-required banner, even if a document is CORRECTION_REQUIRED', () => {
    const booking = makeBooking({
      status: 'CANCELLED',
      verificationDocuments: [
        { kind: 'GOV_ID_1', status: 'CORRECTION_REQUIRED', reviewNote: null, uploadedAt: '2026-09-01T00:00:00.000Z', reviewedAt: null },
      ],
    });
    expect(getNextStep(booking)).toEqual({ tone: 'neutral', message: 'This booking was cancelled.' });
  });

  it('COMPLETED never shows the "resubmit deposit proof" banner, even if the deposit proof is REJECTED', () => {
    const booking = makeBooking({
      status: 'COMPLETED',
      securityDeposit: {
        requiredCentavos: 50000,
        verifiedCentavos: 0,
        verified: false,
        proofStatus: 'REJECTED',
        reviewNote: 'Unclear receipt',
        amountClaimedCentavos: null,
      },
    });
    expect(getNextStep(booking).tone).toBe('neutral');
    expect(getNextStep(booking).cta).toBeUndefined();
  });

  it('COMPLETED never shows the "resubmit rental fee proof" banner, even if the rental fee proof is REJECTED', () => {
    const booking = makeBooking({
      status: 'COMPLETED',
      rentalFee: {
        dueCentavos: 100000,
        paidCentavos: 0,
        outstandingCentavos: 100000,
        status: 'PENDING',
        dueDate: '2026-10-01T00:00:00.000Z',
        proofStatus: 'REJECTED',
        reviewNote: null,
        amountClaimedCentavos: null,
      },
    });
    expect(getNextStep(booking).tone).toBe('neutral');
    expect(getNextStep(booking).cta).toBeUndefined();
  });

  it('a non-terminal booking with a CORRECTION_REQUIRED document still gets the actionable banner (unchanged behavior)', () => {
    const booking = makeBooking({
      status: 'AWAITING_PAYMENT',
      verificationDocuments: [
        { kind: 'GOV_ID_1', status: 'CORRECTION_REQUIRED', reviewNote: null, uploadedAt: '2026-09-01T00:00:00.000Z', reviewedAt: null },
      ],
    });
    const step = getNextStep(booking);
    expect(step.tone).toBe('danger');
    expect(step.cta?.label).toBe('Upload replacement documents');
  });

  it('a non-terminal booking with a REJECTED deposit proof still gets the actionable banner (unchanged behavior)', () => {
    const booking = makeBooking({
      status: 'AWAITING_PAYMENT',
      securityDeposit: {
        requiredCentavos: 50000,
        verifiedCentavos: 0,
        verified: false,
        proofStatus: 'REJECTED',
        reviewNote: 'Unclear receipt',
        amountClaimedCentavos: null,
      },
    });
    const step = getNextStep(booking);
    expect(step.tone).toBe('danger');
    expect(step.cta?.label).toBe('Resubmit deposit proof');
  });
});

describe('hasOutstandingPayment — terminal bookings never count toward the Payment tab', () => {
  it('excludes a CANCELLED booking even with an unpaid, required deposit', () => {
    const booking = makeBooking({ status: 'CANCELLED' });
    expect(hasOutstandingPayment(booking)).toBe(false);
  });

  it('excludes a COMPLETED booking even with an outstanding rental fee', () => {
    const booking = makeBooking({
      status: 'COMPLETED',
      rentalFee: {
        dueCentavos: 100000,
        paidCentavos: 0,
        outstandingCentavos: 100000,
        status: 'PENDING',
        dueDate: '2026-10-01T00:00:00.000Z',
      },
    });
    expect(hasOutstandingPayment(booking)).toBe(false);
  });

  it('still includes a non-terminal booking with an unpaid, required deposit (unchanged behavior)', () => {
    const booking = makeBooking({ status: 'AWAITING_PAYMENT' });
    expect(hasOutstandingPayment(booking)).toBe(true);
  });

  it('still includes a RETURNED booking with an outstanding rental fee (unchanged behavior — not terminal)', () => {
    const booking = makeBooking({
      status: 'RETURNED',
      rentalFee: {
        dueCentavos: 100000,
        paidCentavos: 0,
        outstandingCentavos: 100000,
        status: 'PENDING',
        dueDate: '2026-10-01T00:00:00.000Z',
      },
    });
    expect(hasOutstandingPayment(booking)).toBe(true);
  });
});

describe('getChargeProofState — additional-charge payment proof states', () => {
  it('reads no-proof-yet as payable', () => {
    expect(getChargeProofState(makeCharge({ paymentProof: null }))).toBe('payable');
  });

  it('reads a nested paymentProof.status of PENDING_REVIEW as pending_review', () => {
    expect(
      getChargeProofState(
        makeCharge({
          paymentProof: { status: 'PENDING_REVIEW', method: 'GCASH', amountClaimedCentavos: 20000, uploadedAt: '2026-10-04T00:00:00.000Z', reviewNote: null },
        }),
      ),
    ).toBe('pending_review');
  });

  it('reads a nested paymentProof.status of APPROVED as approved', () => {
    expect(
      getChargeProofState(
        makeCharge({
          paymentProof: { status: 'APPROVED', method: 'GCASH', amountClaimedCentavos: 20000, uploadedAt: '2026-10-04T00:00:00.000Z', reviewNote: null },
        }),
      ),
    ).toBe('approved');
  });

  it('reads a nested paymentProof.status of REJECTED as rejected', () => {
    expect(
      getChargeProofState(
        makeCharge({
          paymentProof: { status: 'REJECTED', method: 'GCASH', amountClaimedCentavos: 20000, uploadedAt: '2026-10-04T00:00:00.000Z', reviewNote: 'Blurry receipt' },
        }),
      ),
    ).toBe('rejected');
  });

  it('treats PAID/WAIVED/REVERSED as terminal regardless of paymentProof', () => {
    expect(getChargeProofState(makeCharge({ status: 'PAID' }))).toBe('paid');
    expect(getChargeProofState(makeCharge({ status: 'WAIVED' }))).toBe('waived');
    expect(getChargeProofState(makeCharge({ status: 'REVERSED' }))).toBe('reversed');
  });
});

describe('return condition mapping (RMS returnCondition)', () => {
  const inspecting = (returnCondition?: RmsMyBooking['returnCondition'], extra: Partial<RmsMyBooking> = {}) =>
    makeBooking({ status: 'PENDING_FOR_INSPECTION', returnCondition, ...extra });

  it('maps each RMS condition for a booking under inspection', () => {
    expect(getBookingStatusLabel(inspecting('UNDER_INSPECTION'))).toBe('Return Under Inspection');
    expect(getBookingStatusLabel(inspecting('CLEAN'))).toBe('Return Cleared');
    expect(getBookingStatusLabel(inspecting('ISSUE_UNRESOLVED'))).toBe('Return Issue Found');
    expect(getBookingStatusLabel(inspecting('ISSUE_RESOLVED'))).toBe('Return Issue Resolved');
  });

  it('shows an issue for missing/lost items even with no damage report', () => {
    const booking = inspecting('ISSUE_UNRESOLVED', { damageReports: [] });
    expect(getReturnOutcome(booking)).toBe('issue');
    const step = getNextStep(booking);
    expect(step.tone).toBe('warning');
    expect(step.cta).toBeUndefined();
  });

  it('offers the inspection CTA only when a damage report exists', () => {
    const booking = inspecting('ISSUE_UNRESOLVED', {
      damageReports: [{ damageNumber: 'D1', itemName: 'Tent', severity: 'MINOR', description: 'Tear', chargeCentavos: 0, createdAt: '2026-10-04T00:00:00.000Z' }],
    });
    expect(getNextStep(booking).cta?.targetId).toBe('gear-inspection-b1');
  });

  it('falls back to damageReports when returnCondition is absent (older RMS)', () => {
    expect(getReturnOutcome(inspecting(undefined))).toBe('inspecting');
    expect(getBookingStatusLabel(inspecting(undefined))).toBe('Return Under Inspection');
  });

  it('COMPLETED keeps the recorded condition', () => {
    const resolved = makeBooking({ status: 'COMPLETED', returnCondition: 'ISSUE_RESOLVED' });
    expect(getNextStep(resolved).message).toContain('resolved');
    expect(getNextStep(makeBooking({ status: 'COMPLETED', returnCondition: 'CLEAN' })).message).toContain('Trip completed');
  });

  it('CANCELLED never reads as under inspection', () => {
    const booking = makeBooking({ status: 'CANCELLED', returnCondition: 'UNDER_INSPECTION' });
    expect(getReturnOutcome(booking)).toBe('none');
    expect(getNextStep(booking).message).toBe('This booking was cancelled.');
  });
});

describe('hasOutstandingPayment — deposit refunded/forfeited or not required', () => {
  const dep = (over: Partial<RmsMyBooking['securityDeposit']>) => ({
    requiredCentavos: 50000, verifiedCentavos: 0, verified: false, proofStatus: null as RmsMyBooking['securityDeposit']['proofStatus'], reviewNote: null, amountClaimedCentavos: null, ...over,
  });

  it('a deposit refunded after an approved proof is not "owed" on a non-terminal (RETURNED) booking', () => {
    expect(hasOutstandingPayment(makeBooking({ status: 'RETURNED', securityDeposit: dep({ proofStatus: 'APPROVED', refundedCentavos: 50000 }) }))).toBe(false);
  });

  it('a deposit forfeited to cover damage is not "owed"', () => {
    expect(hasOutstandingPayment(makeBooking({ status: 'PENDING_FOR_INSPECTION', securityDeposit: dep({ proofStatus: 'APPROVED', retainedCentavos: 50000 }) }))).toBe(false);
  });

  it('a deposit short because an add-on raised the requirement is still owed', () => {
    expect(hasOutstandingPayment(makeBooking({ status: 'RESERVED', securityDeposit: dep({ proofStatus: 'APPROVED', verifiedCentavos: 40000, requiredCentavos: 50000 }) }))).toBe(true);
  });

  it('a zero-deposit package is never outstanding', () => {
    expect(hasOutstandingPayment(makeBooking({ status: 'RESERVED', securityDeposit: dep({ requiredCentavos: 0 }) }))).toBe(false);
  });
});

describe('classifyMyBookingsLoadError', () => {
  it('a missing VITE_RMS_API_URL (rmsFetch\'s own client-side error) is "not_configured"', () => {
    const err = new RmsApiError('not configured', 500, undefined, undefined, { code: RMS_NOT_CONFIGURED_CODE });
    expect(classifyMyBookingsLoadError(err)).toBe('not_configured');
  });

  it('a genuine RMS HTTP 500 is an ordinary retryable error, never "not_configured"', () => {
    expect(classifyMyBookingsLoadError(new RmsApiError('Booking could not be created', 500))).toBe('error');
    expect(classifyMyBookingsLoadError(new RmsApiError('boom', 500, undefined, undefined, { code: 'SOMETHING_ELSE' }))).toBe('error');
  });

  it('502/503/504 (and 429) keep the ordinary retryable error behaviour', () => {
    for (const status of [502, 503, 504, 429]) {
      expect(classifyMyBookingsLoadError(new RmsApiError('x', status))).toBe('error');
    }
  });

  it('a 401 (already ruled out as "no Customer row yet" upstream) still means the session expired', () => {
    expect(classifyMyBookingsLoadError(new RmsApiError('Not authenticated', 401))).toBe('session_expired');
  });

  it('a network failure or unknown throw is an ordinary error', () => {
    expect(classifyMyBookingsLoadError(new TypeError('Failed to fetch'))).toBe('error');
    expect(classifyMyBookingsLoadError('nope')).toBe('error');
  });
});
