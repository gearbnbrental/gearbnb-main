import { describe, expect, it, vi } from 'vitest';
import { applyCartLinkPlan } from '../context/RentalContext';
import type { BookableGearKind, CartState, PackageKit, TripDetails } from '../types/gearbnb';
import {
  CATALOG_UNAVAILABLE_NOTICE,
  INVALID_LINK_NOTICE,
  cartEntriesSignature,
  cartLinkValue,
  createCartLinkRunner,
  parseCartLink,
  resolveCartLink,
  withoutCartLinkParams,
  type CartLink,
  type CartLinkCatalog,
} from './aiCartLink';
import { kitForEdition } from './kitEdition';
import { trackAddToCart } from './metaTracking';

const TODAY = '2026-11-19';

const trip: TripDetails = { startDate: '', returnDate: '', fulfillmentType: 'pickup', deliveryAddress: '', preferredTime: '', destination: '' };

function emptyCart(overrides: Partial<CartState> = {}): CartState {
  return {
    selectedKits: [],
    entryDates: {},
    kitExtras: {},
    packageAddOns: {},
    selectedItems: [],
    itemExtras: {},
    byoGears: [],
    byoAddOns: {},
    tripDetails: trip,
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

function gear(overrides: Partial<BookableGearKind>): BookableGearKind {
  return {
    category: 'Chair',
    brand: 'Naturehike',
    model: 'Kermit',
    name: 'Kermit Chair',
    pricing: { '48h': 150, '72h': 200 },
    extraPerDayPrice: 50,
    quantity: 6,
    availableCount: 6,
    canSelect: true,
    imageUrl: null,
    freeAccessories: [],
    compatibleAddOns: [],
    ...overrides,
  };
}

const kermitChair = gear({ catalogId: 'chair-naturehike-kermit' });
const moonChair = gear({
  model: 'Moon',
  name: 'Moon Chair',
  pricing: { '48h': 120, '72h': 180 },
  variants: [
    { catalogId: 'chair-naturehike-moon-black', color: 'Black', imageUrl: null, quantity: 4, availableCount: 4, canSelect: true },
    {
      catalogId: 'chair-naturehike-moon-khaki',
      color: 'Khaki',
      imageUrl: null,
      quantity: 2,
      availableCount: 2,
      canSelect: true,
      pricing: { '48h': 130, '72h': 190 },
    },
  ],
});
const gearKinds = [kermitChair, moonChair];

const baseCamper: PackageKit = {
  id: 'base-black',
  name: 'The Base Camper Kit',
  description: 'Black',
  packageNumber: 'PKG-0004',
  depositAmount: 1000,
  pricing: { '48h': 1500, '72h': 2000 },
  extraPerDayPrice: 400,
  includedItems: [],
  paxRange: '',
  capacity: 0,
  imageUrl: 'black.jpg',
  editions: [
    {
      id: 'base-black',
      label: 'BLACK',
      imageUrl: 'black.jpg',
      packageNumber: 'PKG-0004',
      pricing: { '48h': 1500, '72h': 2000 },
      depositAmount: 1000,
      extraPerDayPrice: 400,
      description: 'Black',
    },
    {
      id: 'base-khaki',
      label: 'KHAKI',
      imageUrl: 'khaki.jpg',
      packageNumber: 'PKG-0003',
      pricing: { '48h': 1600, '72h': 2100 },
      depositAmount: 1200,
      extraPerDayPrice: 450,
      description: 'Khaki',
    },
  ],
};
const nomad: PackageKit = { ...baseCamper, id: 'nomad', name: 'The Nomad Kit', packageNumber: 'PKG-0001', editions: undefined };
const kits = [baseCamper, nomad];

const link = (query: string) => parseCartLink(query, TODAY);
const validLink = (query: string): CartLink => {
  const result = link(query);
  if (result.status !== 'valid') throw new Error(`expected a valid link, got ${result.status}`);
  return result.link;
};

describe('parseCartLink', () => {
  it('reads a valid link', () => {
    expect(link('?ai=1&start=2026-12-20&duration=72&items=package:PKG-0004:1,item:chair-naturehike-moon-black:2')).toEqual({
      status: 'valid',
      link: {
        startDate: '2026-12-20',
        duration: '72',
        lines: [
          { type: 'package', id: 'PKG-0004', quantity: 1 },
          { type: 'item', id: 'chair-naturehike-moon-black', quantity: 2 },
        ],
      },
    });
  });

  it('ignores an address that is not an AI cart link', () => {
    expect(link('')).toEqual({ status: 'absent' });
    expect(link('?fbclid=abc')).toEqual({ status: 'absent' });
  });

  it.each([
    ['a date that does not exist', 'ai=1&start=2026-02-30&duration=48&items=item:a:1'],
    ['a badly written date', 'ai=1&start=20-12-2026&duration=48&items=item:a:1'],
    ['a date in the past', 'ai=1&start=2026-11-18&duration=48&items=item:a:1'],
    ['a date more than a year out', 'ai=1&start=2028-01-01&duration=48&items=item:a:1'],
    ['a 24 hour duration', 'ai=1&start=2026-12-20&duration=24&items=item:a:1'],
    ['ai other than 1', 'ai=yes&start=2026-12-20&duration=48&items=item:a:1'],
    ['13 lines', `ai=1&start=2026-12-20&duration=48&items=${Array.from({ length: 13 }, (_, i) => `item:g${i}:1`).join(',')}`],
    ['two packages', 'ai=1&start=2026-12-20&duration=48&items=package:PKG-0001:1,package:PKG-0004:1'],
    ['a package quantity of 2', 'ai=1&start=2026-12-20&duration=48&items=package:PKG-0001:2'],
    ['quantity 0', 'ai=1&start=2026-12-20&duration=48&items=item:a:0'],
    ['quantity 21', 'ai=1&start=2026-12-20&duration=48&items=item:a:21'],
    ['a fractional quantity', 'ai=1&start=2026-12-20&duration=48&items=item:a:1.5'],
    ['an id with other characters', 'ai=1&start=2026-12-20&duration=48&items=item:a%2Fb:1'],
    ['an unknown line type', 'ai=1&start=2026-12-20&duration=48&items=coupon:FREE:1'],
    ['a line with missing parts', 'ai=1&start=2026-12-20&duration=48&items=item:a'],
    ['no lines', 'ai=1&start=2026-12-20&duration=48&items='],
    ['the same item twice', 'ai=1&start=2026-12-20&duration=48&items=item:a:1,item:A:2'],
    ['a repeated parameter', 'ai=1&start=2026-12-20&start=2026-12-21&duration=48&items=item:a:1'],
    ['a missing parameter', 'ai=1&start=2026-12-20&items=item:a:1'],
  ])('refuses %s', (_, query) => {
    expect(link(query)).toEqual({ status: 'invalid' });
  });

  it('accepts today (Manila) as the start date', () => {
    expect(link(`ai=1&start=${TODAY}&duration=48&items=item:a:1`).status).toBe('valid');
  });

  it('removes only its own parameters from the address', () => {
    expect(withoutCartLinkParams('?ai=1&start=2026-12-20&duration=48&items=item:a:1&fbclid=xyz')).toBe('?fbclid=xyz');
    expect(withoutCartLinkParams('?ai=1&start=2026-12-20&duration=48&items=item:a:1')).toBe('');
  });
});

describe('resolveCartLink', () => {
  it('sets the dates from the duration: 48 hours is two days, 72 hours three', () => {
    expect(resolveCartLink(validLink('ai=1&start=2026-12-20&duration=48&items=item:chair-naturehike-kermit:1'), kits, gearKinds)).toMatchObject({
      startDate: '2026-12-20',
      returnDate: '2026-12-22',
    });
    expect(resolveCartLink(validLink('ai=1&start=2026-12-30&duration=72&items=item:chair-naturehike-kermit:1'), kits, gearKinds)).toMatchObject({
      startDate: '2026-12-30',
      returnDate: '2027-01-02',
    });
  });

  it('leaves out an id the catalog does not list, and counts it', () => {
    const plan = resolveCartLink(
      validLink('ai=1&start=2026-12-20&duration=48&items=item:chair-naturehike-kermit:2,item:tent-made-up:1'),
      kits,
      gearKinds,
    );
    expect(plan.gears.map((g) => [g.gear.name, g.quantity])).toEqual([['Kermit Chair', 2]]);
    expect(plan.skipped).toBe(1);
  });

  it('matches a package number whatever its case, picking that colour of the package', () => {
    const plan = resolveCartLink(validLink('ai=1&start=2026-12-20&duration=48&items=package:pkg-0003:1'), kits, gearKinds);
    expect(plan.kit).toMatchObject({ id: 'base-khaki', packageNumber: 'PKG-0003', depositAmount: 1200, name: 'The Base Camper Kit (KHAKI)' });
    expect(resolveCartLink(validLink('ai=1&start=2026-12-20&duration=48&items=package:PKG-0001:1'), kits, gearKinds).kit?.id).toBe('nomad');
  });

  it('leaves out an out-of-stock package', () => {
    const plan = resolveCartLink(validLink('ai=1&start=2026-12-20&duration=48&items=package:PKG-0001:1'), [{ ...nomad, isOutOfStock: true }], gearKinds);
    expect(plan.kit).toBeNull();
    expect(plan.skipped).toBe(1);
  });

  it('picks the colour a variant id names, with that colour own price and stock', () => {
    const plan = resolveCartLink(validLink('ai=1&start=2026-12-20&duration=48&items=item:chair-naturehike-moon-khaki:1'), kits, gearKinds);
    expect(plan.gears[0].gear).toMatchObject({ color: 'Khaki', name: 'Moon Chair (Khaki)', quantity: 2, pricing: { '48h': 130, '72h': 190 } });
    expect(plan.gears[0].gear.variants).toBeUndefined();
  });

  it('never matches a multi-colour kind by an id of its own, and never guesses an id', () => {
    const plan = resolveCartLink(
      validLink('ai=1&start=2026-12-20&duration=48&items=item:chair-naturehike-moon:1'),
      kits,
      [{ ...moonChair, catalogId: 'chair-naturehike-moon' }, gear({ catalogId: undefined, name: 'No id yet' })],
    );
    expect(plan.gears).toEqual([]);
    expect(plan.skipped).toBe(1);
  });

  it('never adds more units than exist', () => {
    const plan = resolveCartLink(validLink('ai=1&start=2026-12-20&duration=48&items=item:chair-naturehike-moon-khaki:5'), kits, gearKinds);
    expect(plan.gears[0].quantity).toBe(2);
  });

  it('works out the rental fee the cart will show', () => {
    const plan = resolveCartLink(
      validLink('ai=1&start=2026-12-20&duration=72&items=package:PKG-0003:1,item:chair-naturehike-kermit:2'),
      kits,
      gearKinds,
    );
    expect(cartLinkValue(plan, trip)).toBe(2100 + 2 * 200);
  });
});

describe('applyCartLinkPlan', () => {
  it('adds Build Your Own gear for the link dates, as if added by hand', () => {
    const plan = resolveCartLink(
      validLink('ai=1&start=2026-12-20&duration=48&items=item:chair-naturehike-kermit:2,item:chair-naturehike-moon-black:1'),
      kits,
      gearKinds,
    );
    const cart = applyCartLinkPlan(emptyCart(), plan);
    expect(cart.tripDetails).toMatchObject({ startDate: '2026-12-20', returnDate: '2026-12-22' });
    expect(cart.byoGears.map((g) => [g.name, g.quantity, g.startDate, g.returnDate])).toEqual([
      ['Kermit Chair', 2, '2026-12-20', '2026-12-22'],
      ['Moon Chair (Black)', 1, '2026-12-20', '2026-12-22'],
    ]);
    expect(cart.checkoutSelection.byoGearKeys).toHaveLength(2);
  });

  it('adds a package with the link gear as its extras, on the package own package number', () => {
    const plan = resolveCartLink(
      validLink('ai=1&start=2026-12-20&duration=72&items=package:PKG-0003:1,item:chair-naturehike-kermit:2'),
      kits,
      gearKinds,
    );
    const cart = applyCartLinkPlan(emptyCart(), plan);
    expect(cart.selectedKits.map((k) => [k.id, k.packageNumber])).toEqual([['base-khaki', 'PKG-0003']]);
    expect(cart.entryDates['kit:base-khaki']).toEqual({ startDate: '2026-12-20', returnDate: '2026-12-23' });
    expect(cart.packageAddOns['base-khaki'].map((g) => [g.name, g.quantity])).toEqual([['Kermit Chair', 2]]);
    expect(cart.byoGears).toEqual([]);
  });

  it('keeps what was already in the cart but unticks it, so checkout starts with what the link prepared', () => {
    const before = applyCartLinkPlan(emptyCart(), resolveCartLink(validLink('ai=1&start=2026-12-05&duration=48&items=package:PKG-0001:1'), kits, gearKinds));
    const after = applyCartLinkPlan(
      before,
      resolveCartLink(validLink('ai=1&start=2026-12-20&duration=48&items=item:chair-naturehike-kermit:1'), kits, gearKinds),
    );
    expect(after.selectedKits.map((k) => k.id)).toEqual(['nomad']);
    expect(after.checkoutSelection.kitIds).toEqual([]);
    expect(after.checkoutSelection.byoGearKeys).toHaveLength(1);
  });

  it('moves a package already in the cart to the link dates', () => {
    const first = applyCartLinkPlan(emptyCart(), resolveCartLink(validLink('ai=1&start=2026-12-05&duration=48&items=package:PKG-0001:1'), kits, gearKinds));
    const again = applyCartLinkPlan(first, resolveCartLink(validLink('ai=1&start=2026-12-20&duration=72&items=package:PKG-0001:1'), kits, gearKinds));
    expect(again.selectedKits).toHaveLength(1);
    expect(again.entryDates['kit:nomad']).toEqual({ startDate: '2026-12-20', returnDate: '2026-12-23' });
    expect(again.checkoutSelection.kitIds).toEqual(['nomad']);
  });
});

describe('kitForEdition', () => {
  it('uses the colour own package number, price and deposit, not the first colour', () => {
    const khaki = kitForEdition(baseCamper, baseCamper.editions![1]);
    expect(khaki).toMatchObject({ id: 'base-khaki', packageNumber: 'PKG-0003', depositAmount: 1200, pricing: { '48h': 1600, '72h': 2100 } });
    expect(khaki.editions).toBeUndefined();
  });
});

describe('cartEntriesSignature', () => {
  it('changes when the camper changes what is in the cart, not when only the browsed dates change', () => {
    const cart = applyCartLinkPlan(
      emptyCart(),
      resolveCartLink(validLink('ai=1&start=2026-12-20&duration=48&items=item:chair-naturehike-kermit:2'), kits, gearKinds),
    );
    const signature = cartEntriesSignature(cart);
    expect(cartEntriesSignature({ ...cart, tripDetails: { ...cart.tripDetails, startDate: '2026-12-01' } })).toBe(signature);
    expect(cartEntriesSignature({ ...cart, byoGears: cart.byoGears.map((g) => ({ ...g, quantity: 3 })) })).not.toBe(signature);
  });
});

describe('createCartLinkRunner', () => {
  const ready: CartLinkCatalog = { authReady: true, packagesState: 'ready', kits, gearState: 'ready', gearKinds, tripDetails: trip };
  const search = '?ai=1&start=2026-12-20&duration=48&items=item:chair-naturehike-kermit:2';

  function setup() {
    const effects = { apply: vi.fn(), notify: vi.fn(), clearLink: vi.fn(), track: vi.fn() };
    return { effects, runner: createCartLinkRunner(effects, () => TODAY) };
  }

  it('fills the cart and fires AddToCart exactly once per link, however often the page re-renders', () => {
    const { effects, runner } = setup();
    runner.run(search, { ...ready, authReady: false });
    runner.run(search, { ...ready, gearState: 'loading', gearKinds: null });
    expect(effects.apply).not.toHaveBeenCalled();
    runner.run(search, ready);
    runner.run(search, ready);
    runner.run(search, { ...ready, tripDetails: { ...trip, startDate: '2026-12-20' } });
    expect(effects.apply).toHaveBeenCalledTimes(1);
    expect(effects.track).toHaveBeenCalledTimes(1);
    expect(effects.track).toHaveBeenCalledWith('build_your_own', 300);
    expect(effects.clearLink).toHaveBeenCalledTimes(1);
  });

  it('fires nothing for a link that filled nothing', () => {
    const { effects, runner } = setup();
    runner.run('?ai=1&start=2026-12-20&duration=48&items=item:no-such-gear:1', ready);
    expect(effects.apply).not.toHaveBeenCalled();
    expect(effects.track).not.toHaveBeenCalled();
    expect(effects.notify).toHaveBeenCalledWith('1 item from the link is no longer available and was left out.');
  });

  it('says a broken link was not valid, adds nothing and clears it from the address', () => {
    const { effects, runner } = setup();
    runner.run('?ai=1&start=2026-12-20&duration=24&items=item:a:1', ready);
    expect(effects.notify).toHaveBeenCalledWith(INVALID_LINK_NOTICE);
    expect(effects.clearLink).toHaveBeenCalledTimes(1);
    expect(effects.apply).not.toHaveBeenCalled();
    expect(effects.track).not.toHaveBeenCalled();
  });

  it('adds nothing when the gear list failed to load, and keeps the link so opening it again retries', () => {
    const { effects, runner } = setup();
    runner.run(search, { ...ready, gearState: 'error', gearKinds: null });
    expect(effects.notify).toHaveBeenCalledWith(CATALOG_UNAVAILABLE_NOTICE);
    expect(effects.clearLink).not.toHaveBeenCalled();
    expect(effects.apply).not.toHaveBeenCalled();
  });

  it('notes the lines it left out while still adding the rest', () => {
    const { effects, runner } = setup();
    runner.run('?ai=1&start=2026-12-20&duration=48&items=item:chair-naturehike-kermit:1,item:gone:1,item:gone-too:1', ready);
    expect(effects.apply).toHaveBeenCalledTimes(1);
    expect(effects.notify).toHaveBeenCalledWith('2 items from the link are no longer available and were left out.');
  });
});

describe('trackAddToCart with a value', () => {
  it('sends the value in pesos with the currency, and only with consent', () => {
    const fbq = vi.fn();
    trackAddToCart('package', 2500, { consent: 'granted', fbq });
    trackAddToCart('package', 2500, { consent: 'denied', fbq });
    expect(fbq.mock.calls).toEqual([
      ['track', 'AddToCart', { value: 2500, currency: 'PHP', content_type: 'product', content_category: 'package' }],
    ]);
  });
});
