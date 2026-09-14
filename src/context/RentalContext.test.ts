import { describe, expect, it } from 'vitest';
import {
  calculateDueBeforeStart,
  calculateDueToday,
  calculateItemExtrasFee,
  calculateKitExtrasFee,
  calculateRentalDurationDays,
  checkItemAvailability,
  checkKitAvailability,
  getItemPrice,
  getKitPrice,
  isVerificationComplete,
} from './RentalContext';
import type {
  CartState,
  IndividualItem,
  PackageKit,
  TripDetails,
  VerificationDocs,
} from '../types/gearbnb';

/**
 * These tests pin down the pricing/availability behaviour that exists today so it can't shift
 * unnoticed while the RMS integration is built. They deliberately assert current behaviour only —
 * including the known duration-tier limitation noted below — and introduce no new business rules.
 */

function makeTripDetails(overrides: Partial<TripDetails> = {}): TripDetails {
  return {
    startDate: '',
    returnDate: '',
    fulfillmentType: 'pickup',
    deliveryAddress: '',
    preferredTime: '',
    destination: '',
    ...overrides,
  };
}

function makeKit(overrides: Partial<PackageKit> = {}): PackageKit {
  return {
    id: 'kit-test',
    packageNumber: 'PKG-TEST',
    name: 'Test Kit',
    description: '',
    depositAmount: 400,
    pricing: { '48h': 2490, '72h': 2790 },
    extraPerDayPrice: 300,
    includedItems: [],
    paxRange: '1–2 Pax',
    capacity: 2,
    imageUrl: '',
    ...overrides,
  };
}

function makeItem(overrides: Partial<IndividualItem> = {}): IndividualItem {
  return {
    id: 'item-test',
    name: 'Test Item',
    category: 'Tents',
    pricing: { '48h': 180, '72h': 198 },
    depositAmount: 500,
    imageUrl: '',
    ...overrides,
  };
}

function makeVerificationDocs(overrides: Partial<VerificationDocs> = {}): VerificationDocs {
  return {
    fullName: 'Juan Dela Cruz',
    phone: '09171234567',
    email: 'juan@example.com',
    documents: {
      idType1: { name: 'id1.jpg', size: 1000, type: 'image/jpeg', storagePath: 'user-1/id1.jpg' },
      idType2: { name: 'id2.jpg', size: 1000, type: 'image/jpeg', storagePath: 'user-1/id2.jpg' },
      verificationVideo: { name: 'capture.mp4', size: 2000, type: 'video/mp4', storagePath: 'user-1/capture.mp4' },
      proofOfBilling: { name: 'bill.pdf', size: 1500, type: 'application/pdf', storagePath: 'user-1/bill.pdf' },
    },
    termsAccepted: true,
    byoAgreementAccepted: true,
    confirmed: true,
    ...overrides,
  };
}

function makeCart(overrides: Partial<CartState> = {}): CartState {
  return {
    selectedKits: [],
    kitExtras: {},
    selectedItems: [],
    itemExtras: {},
    byoGears: [],
    byoAddOns: {},
    tripDetails: makeTripDetails(),
    verificationDocs: makeVerificationDocs(),
    checkoutSelection: { kitIds: [], itemIds: [], byoGearKeys: [] },
    removedItemNames: [],
    ...overrides,
  };
}

describe('calculateRentalDurationDays', () => {
  it('counts whole days between start and return', () => {
    expect(
      calculateRentalDurationDays(makeTripDetails({ startDate: '2026-09-10', returnDate: '2026-09-12' })),
    ).toBe(2);
  });

  it('returns 0 when either date is missing', () => {
    expect(calculateRentalDurationDays(makeTripDetails({ startDate: '2026-09-10' }))).toBe(0);
    expect(calculateRentalDurationDays(makeTripDetails({ returnDate: '2026-09-12' }))).toBe(0);
  });

  it('returns 0 when the return date is not after the start date', () => {
    expect(
      calculateRentalDurationDays(makeTripDetails({ startDate: '2026-09-12', returnDate: '2026-09-12' })),
    ).toBe(0);
    expect(
      calculateRentalDurationDays(makeTripDetails({ startDate: '2026-09-12', returnDate: '2026-09-10' })),
    ).toBe(0);
  });

  it('returns 0 for unparseable dates', () => {
    expect(
      calculateRentalDurationDays(makeTripDetails({ startDate: 'not-a-date', returnDate: '2026-09-12' })),
    ).toBe(0);
  });
});

describe('duration tier selection', () => {
  const kit = makeKit();
  const item = makeItem();

  it('uses the 72h tier for an exactly 3-day rental', () => {
    const trip = makeTripDetails({ startDate: '2026-09-10', returnDate: '2026-09-13' });
    expect(getKitPrice(kit, trip)).toBe(2790);
    expect(getItemPrice(item, trip)).toBe(198);
  });

  it('uses the 48h tier for a 2-day rental', () => {
    const trip = makeTripDetails({ startDate: '2026-09-10', returnDate: '2026-09-12' });
    expect(getKitPrice(kit, trip)).toBe(2490);
    expect(getItemPrice(item, trip)).toBe(180);
  });

  it('charges the 72h tier plus the configured extra-day rate for a package rental longer than 3 days', () => {
    // A 5-day rental is 2 extra days beyond the 72h tier: 2790 + 2*300 = 3390. Real gear
    // (IndividualItem) has no extra-day rate at all yet, so it still falls back to the 48h tier —
    // that limitation is unchanged; only Package pricing (getKitPrice) gained extra-day support.
    const trip = makeTripDetails({ startDate: '2026-09-10', returnDate: '2026-09-15' });
    expect(getKitPrice(kit, trip)).toBe(3390);
    expect(getItemPrice(item, trip)).toBe(180);
  });

  it('never charges for extra days when the kit has no configured per-day rate', () => {
    const kitWithoutExtraDayRate = makeKit({ extraPerDayPrice: undefined });
    const trip = makeTripDetails({ startDate: '2026-09-10', returnDate: '2026-09-15' });
    expect(getKitPrice(kitWithoutExtraDayRate, trip)).toBe(2790);
  });

  it('falls back to the 48h tier when no dates are set', () => {
    expect(getKitPrice(kit, makeTripDetails())).toBe(2490);
    expect(getItemPrice(item, makeTripDetails())).toBe(180);
  });
});

describe('calculateDueToday', () => {
  it('sums deposits across kits and items', () => {
    const cart = makeCart({
      selectedKits: [makeKit({ depositAmount: 400 }), makeKit({ id: 'kit-2', depositAmount: 900 })],
      selectedItems: [makeItem({ depositAmount: 500 })],
    });
    expect(calculateDueToday(cart)).toBe(1800);
  });

  it('is 0 for an empty cart', () => {
    expect(calculateDueToday(makeCart())).toBe(0);
  });

  it('ignores rental duration entirely', () => {
    const kits = [makeKit({ depositAmount: 400 })];
    const short = makeCart({ selectedKits: kits, tripDetails: makeTripDetails({ startDate: '2026-09-10', returnDate: '2026-09-12' }) });
    const long = makeCart({ selectedKits: kits, tripDetails: makeTripDetails({ startDate: '2026-09-10', returnDate: '2026-09-20' }) });
    expect(calculateDueToday(short)).toBe(calculateDueToday(long));
  });
});

describe('add-on fees', () => {
  const kitWithExtras = makeKit({
    extras: [
      { id: 'extra-a', name: 'Plus Kit', price: 399, minDurationHours: 0 },
      { id: 'extra-b', name: 'Cooler', price: 999, minDurationHours: 0 },
    ],
  });
  const itemWithAddOns = makeItem({
    paidAddOns: [{ id: 'addon-poles', name: 'Extra Canopy Poles', price: 99, minDurationHours: 0 }],
  });

  it('counts only the selected kit extras', () => {
    const cart = makeCart({ selectedKits: [kitWithExtras], kitExtras: { 'kit-test': ['extra-a'] } });
    expect(calculateKitExtrasFee(cart)).toBe(399);
  });

  it('sums multiple selected kit extras', () => {
    const cart = makeCart({ selectedKits: [kitWithExtras], kitExtras: { 'kit-test': ['extra-a', 'extra-b'] } });
    expect(calculateKitExtrasFee(cart)).toBe(1398);
  });

  it('ignores selected ids that are not offered on the kit', () => {
    const cart = makeCart({ selectedKits: [kitWithExtras], kitExtras: { 'kit-test': ['extra-unknown'] } });
    expect(calculateKitExtrasFee(cart)).toBe(0);
  });

  it('counts only the selected item add-ons', () => {
    const cart = makeCart({ selectedItems: [itemWithAddOns], itemExtras: { 'item-test': ['addon-poles'] } });
    expect(calculateItemExtrasFee(cart)).toBe(99);
  });

  it('is 0 when nothing is selected', () => {
    const cart = makeCart({ selectedKits: [kitWithExtras], selectedItems: [itemWithAddOns] });
    expect(calculateKitExtrasFee(cart)).toBe(0);
    expect(calculateItemExtrasFee(cart)).toBe(0);
  });
});

describe('calculateDueBeforeStart', () => {
  it('combines kit tier prices, item tier prices, and both add-on fees', () => {
    const cart = makeCart({
      tripDetails: makeTripDetails({ startDate: '2026-09-10', returnDate: '2026-09-12' }),
      selectedKits: [makeKit({ extras: [{ id: 'extra-a', name: 'Plus Kit', price: 399, minDurationHours: 0 }] })],
      kitExtras: { 'kit-test': ['extra-a'] },
      selectedItems: [
        makeItem({ paidAddOns: [{ id: 'addon-poles', name: 'Extra Canopy Poles', price: 99, minDurationHours: 0 }] }),
      ],
      itemExtras: { 'item-test': ['addon-poles'] },
    });
    // 2490 (kit 48h) + 399 (kit extra) + 180 (item 48h) + 99 (item add-on)
    expect(calculateDueBeforeStart(cart)).toBe(3168);
  });

  it('excludes deposits', () => {
    const cart = makeCart({
      tripDetails: makeTripDetails({ startDate: '2026-09-10', returnDate: '2026-09-12' }),
      selectedKits: [makeKit({ depositAmount: 5000 })],
    });
    expect(calculateDueBeforeStart(cart)).toBe(2490);
  });

  it('is 0 for an empty cart', () => {
    expect(calculateDueBeforeStart(makeCart())).toBe(0);
  });
});

describe('availability', () => {
  const blackout = [{ start: '2026-08-15', end: '2026-08-17' }];

  it('treats everything as available before dates are chosen', () => {
    expect(checkKitAvailability(makeKit({ unavailableRanges: blackout }), null)).toBe(true);
    expect(checkItemAvailability(makeItem({ unavailableRanges: blackout }), null)).toBe(true);
  });

  it('blocks an out-of-stock kit regardless of dates', () => {
    expect(checkKitAvailability(makeKit({ isOutOfStock: true }), null)).toBe(false);
    expect(
      checkKitAvailability(makeKit({ isOutOfStock: true }), { start: '2026-01-01', end: '2026-01-02' }),
    ).toBe(false);
  });

  it('blocks an out-of-stock item regardless of dates', () => {
    expect(checkItemAvailability(makeItem({ isOutOfStock: true }), null)).toBe(false);
  });

  it('blocks a range overlapping a blackout window', () => {
    const kit = makeKit({ unavailableRanges: blackout });
    expect(checkKitAvailability(kit, { start: '2026-08-16', end: '2026-08-18' })).toBe(false);
    expect(checkKitAvailability(kit, { start: '2026-08-14', end: '2026-08-15' })).toBe(false);
  });

  it('allows a range clear of the blackout window', () => {
    const kit = makeKit({ unavailableRanges: blackout });
    expect(checkKitAvailability(kit, { start: '2026-08-18', end: '2026-08-20' })).toBe(true);
    expect(checkKitAvailability(kit, { start: '2026-08-10', end: '2026-08-14' })).toBe(true);
  });

  it('allows anything with no blackout windows', () => {
    expect(checkItemAvailability(makeItem(), { start: '2026-08-16', end: '2026-08-18' })).toBe(true);
  });
});

describe('isVerificationComplete', () => {
  it('passes when contact details, all slots, terms and confirmation are present (package booking)', () => {
    expect(isVerificationComplete(makeVerificationDocs(), false)).toBe(true);
  });

  it.each(['fullName', 'phone', 'email'] as const)('fails when %s is blank', (field) => {
    expect(isVerificationComplete(makeVerificationDocs({ [field]: '   ' }), false)).toBe(false);
  });

  it.each(['idType1', 'idType2', 'verificationVideo', 'proofOfBilling'] as const)(
    'fails when the %s slot is empty',
    (slot) => {
      const docs = makeVerificationDocs();
      expect(isVerificationComplete({ ...docs, documents: { ...docs.documents, [slot]: null } }, false)).toBe(false);
    },
  );

  it('fails when a file is selected but not yet uploaded (storagePath still null)', () => {
    const docs = makeVerificationDocs();
    const stillUploading = {
      ...docs,
      documents: {
        ...docs.documents,
        idType1: { name: 'id1.jpg', size: 1000, type: 'image/jpeg', storagePath: null },
      },
    };
    expect(isVerificationComplete(stillUploading, false)).toBe(false);
  });

  it('fails when terms are not accepted', () => {
    expect(isVerificationComplete(makeVerificationDocs({ termsAccepted: false }), false)).toBe(false);
  });

  it('fails when the section has not been confirmed', () => {
    expect(isVerificationComplete(makeVerificationDocs({ confirmed: false }), false)).toBe(false);
  });

  it('accepts any file type in a slot — the gate is artifact-agnostic', () => {
    const docs = makeVerificationDocs();
    const asPhoto = {
      ...docs,
      documents: {
        ...docs.documents,
        verificationVideo: { name: 'selfie.jpg', size: 900, type: 'image/jpeg', storagePath: 'user-1/selfie.jpg' },
      },
    };
    expect(isVerificationComplete(asPhoto, false)).toBe(true);
  });

  it('ignores byoAgreementAccepted for a package booking, even if false', () => {
    expect(isVerificationComplete(makeVerificationDocs({ byoAgreementAccepted: false }), false)).toBe(true);
  });

  it('requires byoAgreementAccepted for a BYO booking', () => {
    expect(isVerificationComplete(makeVerificationDocs({ byoAgreementAccepted: false }), true)).toBe(false);
  });

  it('passes for a BYO booking once byoAgreementAccepted is also true', () => {
    expect(isVerificationComplete(makeVerificationDocs({ byoAgreementAccepted: true }), true)).toBe(true);
  });
});
