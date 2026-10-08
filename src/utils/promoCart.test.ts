import { describe, expect, it } from 'vitest';
import { byoGearKey } from '../context/RentalContext';
import type { BookableAddOnSelection, BookableGearSelection, CartState, PackageKit } from '../types/gearbnb';
import { computePromoDiscount, evaluateBasketPromo } from './promo';
import { promoLinesForCart, promoPickupAt } from './promoCart';
import { PROMO_FIXTURES } from './promoFixtures';

function gear(category: string, price48: number, quantity: number, extra: Partial<BookableGearSelection> = {}): BookableGearSelection {
  return {
    category,
    brand: 'Brand',
    model: category,
    name: category,
    pricing: { '48h': price48, '72h': price48 + 100 },
    extraPerDayPrice: 50,
    quantity,
    availableCount: 50,
    canSelect: true,
    imageUrl: null,
    freeAccessories: [],
    compatibleAddOns: [],
    ...extra,
  };
}

const kit: PackageKit = {
  id: 'kit-1',
  packageNumber: 'PKG-1',
  name: 'Kit',
  description: '',
  depositAmount: 400,
  pricing: { '48h': 1950, '72h': 2250 },
  extraPerDayPrice: 300,
  includedItems: [],
  paxRange: '',
  capacity: 2,
  imageUrl: '',
};

function cart(overrides: Partial<CartState>, startDate = '2099-10-20', returnDate = '2099-10-22'): CartState {
  return {
    selectedKits: [],
    kitExtras: {},
    packageAddOns: {},
    selectedItems: [],
    itemExtras: {},
    byoGears: [],
    byoAddOns: {},
    tripDetails: { startDate, returnDate, fulfillmentType: 'pickup', deliveryAddress: '', preferredTime: '', destination: '' },
    verificationDocs: {
      fullName: '',
      phone: '',
      email: '',
      documents: { idType1: null, idType2: null, verificationVideo: null, proofOfBilling: null },
      termsAccepted: false,
      byoAgreementAccepted: false,
      confirmed: false,
    },
    checkoutSelection: { kitIds: [], itemIds: [], byoGearKeys: [], packageAddOnKeys: {}, byoAddOnKeys: {} },
    removedItemNames: [],
    ...overrides,
  };
}

describe('promoLinesForCart', () => {
  it('prices BYO gear and add-ons for the chosen duration, each by its own category', () => {
    const tent = gear('Tent', 1250, 1);
    const pole = { ...gear('Poles', 200, 2), role: 'POLE', maxQuantity: 2 } as BookableAddOnSelection;
    const c = cart({
      byoGears: [tent, gear('Bed', 700, 1)],
      byoAddOns: { [byoGearKey(tent)]: [pole] },
      checkoutSelection: {
        kitIds: [],
        itemIds: [],
        byoGearKeys: [byoGearKey(tent), byoGearKey(gear('Bed', 700, 1))],
        packageAddOnKeys: {},
        byoAddOnKeys: { [byoGearKey(tent)]: [byoGearKey(pole)] },
      },
    });
    const lines = promoLinesForCart(c);
    expect(lines).toEqual([
      { scopeKey: 'TENT', unitPriceCentavos: 125000, quantity: 1 },
      { scopeKey: 'BED', unitPriceCentavos: 70000, quantity: 1 },
      { scopeKey: null, unitPriceCentavos: 20000, quantity: 2 },
    ]);
    expect(computePromoDiscount(PROMO_FIXTURES.percent, lines).discountCentavos).toBe(29250);
  });

  it('uses the 72h-plus-extra-days price when the trip is longer', () => {
    const tent = gear('Tent', 1000, 1);
    const c = cart({ byoGears: [tent], checkoutSelection: { kitIds: [], itemIds: [], byoGearKeys: [byoGearKey(tent)], packageAddOnKeys: {}, byoAddOnKeys: {} } }, '2099-10-20', '2099-10-25');
    // 5 days: 72h tier ₱1,100 + 2 extra days × ₱50
    expect(promoLinesForCart(c)[0].unitPriceCentavos).toBe(120000);
  });

  it('a package is one PACKAGES line, and its extras count by category', () => {
    const chair = gear('Camping Chair', 145, 2);
    const c = cart({
      selectedKits: [kit],
      packageAddOns: { [kit.id]: [chair] },
      checkoutSelection: { kitIds: [kit.id], itemIds: [], byoGearKeys: [], packageAddOnKeys: { [kit.id]: [byoGearKey(chair)] }, byoAddOnKeys: {} },
    });
    expect(promoLinesForCart(c)).toEqual([
      { scopeKey: 'PACKAGES', unitPriceCentavos: 195000, quantity: 1 },
      { scopeKey: 'CAMPING_CHAIR', unitPriceCentavos: 14500, quantity: 2 },
    ]);
  });

  it('only what is checked for checkout counts', () => {
    const tent = gear('Tent', 1250, 1);
    const c = cart({ byoGears: [tent] });
    expect(promoLinesForCart(c)).toEqual([]);
  });

  it('removing items or changing dates updates the result straight away', () => {
    const tent = gear('Tent', 1250, 1);
    const selection = { kitIds: [], itemIds: [], byoGearKeys: [byoGearKey(tent)], packageAddOnKeys: {}, byoAddOnKeys: {} };
    const inWindow = cart({ byoGears: [tent], checkoutSelection: selection }, '2099-10-20', '2099-10-22');
    const outside = cart({ byoGears: [tent], checkoutSelection: selection }, '2099-12-05', '2099-12-07');
    const promo = PROMO_FIXTURES.tripWindow;
    const kindFor = (c: CartState) => evaluateBasketPromo(promo, true, promoLinesForCart(c), promoPickupAt(c.tripDetails), 0).kind;
    expect(kindFor(inWindow)).toBe('unlocked');
    expect(kindFor(outside)).toBe('outside-window');
    expect(kindFor(cart({ checkoutSelection: selection }))).toBe('below-minimum');
  });
});

describe('promoPickupAt', () => {
  it('is Manila midnight until a preferred time is chosen, then that time', () => {
    expect(promoPickupAt({ startDate: '2099-10-15', preferredTime: '' })).toBe('2099-10-14T16:00:00.000Z');
    expect(promoPickupAt({ startDate: '2099-10-15', preferredTime: '10:00' })).toBe('2099-10-15T02:00:00.000Z');
    expect(promoPickupAt({ startDate: '', preferredTime: '10:00' })).toBeNull();
  });
});
