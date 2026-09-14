import type { IndividualItem, PackageKit } from '../types/gearbnb';

const PLUS_KIT_IMAGE = '/images/plus-kit.png';

export const mockPackages: PackageKit[] = [
  {
    id: 'kit-nomad',
    // MOCK-* placeholders never resolve against the real RMS — a booking submitted while the
    // catalog is on mock fallback will correctly fail with "unknown package" rather than silently
    // booking the wrong real kit.
    packageNumber: 'MOCK-NOMAD-BLACK',
    name: 'Nomad Kit',
    description: '1–2 Pax Motocamper Set — everything a solo or duo adventurer needs for a lightweight overnight trip.',
    depositAmount: 400,
    pricing: { '48h': 2490, '72h': 2790 },
    paxRange: '1–2 Pax',
    capacity: 2,
    includedItems: [
      '2-Person Mobi Garden Tent (incl. groundsheet)',
      '1x 1–2 Person Double-Sized Inflatable Bed',
      '2x Ultra-Light Camping Chair',
      '1x Small Camping Table',
      '1x Rechargeable Camping Fan',
    ],
    imageUrl: '/images/packages/nomad-black.png',
    editions: [
      { id: 'kit-nomad-black', label: 'Black Edition', imageUrl: '/images/packages/nomad-black.png', packageNumber: 'MOCK-NOMAD-BLACK' },
      { id: 'kit-nomad-khaki', label: 'Khaki Edition', imageUrl: '/images/packages/nomad-khaki.png', packageNumber: 'MOCK-NOMAD-KHAKI' },
    ],
    unavailableRanges: [{ start: '2026-08-10', end: '2026-08-12' }],
    extras: [
      { id: 'extra-nomad-plus-kit', name: 'Plus Kit Upgrade — Cooking Set', price: 399, minDurationHours: 0, imageUrl: PLUS_KIT_IMAGE },
    ],
  },
  {
    id: 'kit-stargazer',
    packageNumber: 'MOCK-STARGAZER',
    name: 'Stargazer Kit',
    description: '3–4 Pax Casual Glamper Set — built for clear-sky camping with comfort for a small group.',
    depositAmount: 600,
    pricing: { '48h': 3100, '72h': 3400 },
    paxRange: '3–4 Pax',
    capacity: 4,
    includedItems: [
      '4-Person Blackdog Vinyl Tent (incl. groundsheet)',
      '1x 20cm Inflatable King-Sized Bed',
      '2x Black Moon Chair',
      '1x Large Camping Table',
      '1x Rechargeable Camping Fan',
      '3x Inflatable Pillow',
      '1x Clean Bed Sheet',
      '1x Camping Hammer',
    ],
    imageUrl: '/images/packages/stargazer.png',
    extras: [
      { id: 'extra-stargazer-plus-kit', name: 'Plus Kit Upgrade — Cooler + Cooking Set', price: 999, minDurationHours: 0, imageUrl: PLUS_KIT_IMAGE },
    ],
  },
  {
    id: 'kit-basecamper',
    packageNumber: 'MOCK-BASECAMPER-BLACK',
    name: 'Base Camper Kit',
    description: '4–6 Pax Full Camper Set — our full basecamp setup for longer stays and bigger groups.',
    depositAmount: 900,
    pricing: { '48h': 5690, '72h': 6210 },
    paxRange: '4–6 Pax',
    capacity: 6,
    includedItems: [
      '6-Person Vidalido Vicore Tent (incl. groundsheet)',
      '1x 40cm Inflatable King-Sized Bed',
      '1x Rechargeable Camping Fan',
      '1x Extra Long Camping Table',
      '4x Moon Chair',
      '4x Inflatable Pillow',
      '2x Clean Bed Sheet',
      '1x Camping Hammer',
    ],
    imageUrl: '/images/packages/base-camper-black.png',
    editions: [
      { id: 'kit-basecamper-black', label: 'Black Edition', imageUrl: '/images/packages/base-camper-black.png', packageNumber: 'MOCK-BASECAMPER-BLACK' },
      { id: 'kit-basecamper-khaki', label: 'Khaki Edition', imageUrl: '/images/packages/base-camper-khaki.png', packageNumber: 'MOCK-BASECAMPER-KHAKI' },
    ],
    extras: [
      { id: 'extra-basecamper-plus-kit', name: 'Plus Kit Upgrade — Cooler + Cooking Set', price: 999, minDurationHours: 0, imageUrl: PLUS_KIT_IMAGE },
    ],
  },
  {
    id: 'kit-traveler',
    packageNumber: 'MOCK-TRAVELER',
    name: 'Traveler Kit',
    description: '6–8 Pax Casual Glamper Set (Khaki Edition) — spacious enough for the whole crew.',
    depositAmount: 1300,
    pricing: { '48h': 7690, '72h': 8490 },
    paxRange: '6–8 Pax',
    capacity: 8,
    includedItems: [
      '8-Person Naturehike Village 13 Lite Tent (incl. groundsheet)',
      '2x 40cm Inflatable King-Sized Bed',
      '2x Rechargeable Camping Fan',
      '1x Extra Long Camping Table',
      '6x Khaki Moon Chair',
      '6x Khaki Inflatable Pillow',
      '2x Clean Bed Sheet',
      '1x Camping Hammer',
    ],
    imageUrl: '/images/packages/traveler.png',
    extras: [
      { id: 'extra-traveler-plus-kit', name: 'Plus Kit Upgrade — Cooler + Cooking Set', price: 999, minDurationHours: 0, imageUrl: PLUS_KIT_IMAGE },
    ],
  },
  {
    id: 'kit-outlander',
    packageNumber: 'MOCK-OUTLANDER',
    name: 'Outlander Kit',
    description: '6–8 Pax Casual Glamper Set (Black Edition) — spacious enough for the whole crew.',
    depositAmount: 1300,
    pricing: { '48h': 7690, '72h': 8490 },
    paxRange: '6–8 Pax',
    capacity: 8,
    includedItems: [
      '8-Person Blackdog Starchase 13x Tent (incl. groundsheet)',
      '2x 40cm Inflatable King-Sized Bed',
      '2x Rechargeable Camping Fan',
      '1x Extra Long Camping Table',
      '6x Black Moon Chair',
      '6x Black Inflatable Pillow',
      '2x Clean Bed Sheet',
      '1x Camping Hammer',
    ],
    imageUrl: '/images/packages/outlander.png',
    extras: [
      { id: 'extra-outlander-plus-kit', name: 'Plus Kit Upgrade — Cooler + Cooking Set', price: 999, minDurationHours: 0, imageUrl: PLUS_KIT_IMAGE },
    ],
  },
  {
    id: 'kit-wanderer',
    packageNumber: 'MOCK-WANDERER',
    name: 'Wanderer Kit',
    description: '1–2 Pax Motocamper Set (Khaki Edition) — same loadout as the Nomad Kit, built around the Khaki Mobi Garden Tent.',
    // Pricing/deposit reused from the Nomad Kit (same pax range and loadout) as a placeholder —
    // client will provide final numbers via the pricing Excel; not a confirmed real rate.
    depositAmount: 400,
    pricing: { '48h': 2490, '72h': 2790 },
    paxRange: '1–2 Pax',
    capacity: 2,
    includedItems: [
      '2-Person Khaki Mobi Garden Tent (incl. groundsheet)',
      '1x 1–2 Person Double-Sized Inflatable Bed',
      '2x Ultra-Light Camping Chair',
      '1x Small Camping Table',
      '1x Tripod Fan',
    ],
    imageUrl: '/images/products/tents/2p-mobi-garden-tent-khaki.png',
    // Client rule: the Khaki Mobi Garden Tent this kit needs is currently unavailable. The kit
    // still shows up in the catalog per client instruction — it's just marked Out of Stock and
    // can't be added to cart (see checkKitAvailability). Once the real Package schema can model
    // "depends on gear X, whose stock flips this" this flag should be derived, not hand-set.
    isOutOfStock: true,
  },
];

/**
 * Placeholder tier pricing — the signed rental agreement leaves individual add-on pricing blank
 * ("prices to be filled in by GearBnB staff at time of booking"), so these are estimates only.
 * Priced the same way as packages (48h/72h tiers) to match the real RentableGear schema, which
 * has no daily-rate field. See src/pages/Terms.tsx for the real, published policy terms.
 */
// Client rule: tents include a free Groundsheet, beds include a free Bedsheet — shown on the
// storefront only as a "🎁 Free use of ..." marketing signal, never billed separately. Ropes/pegs
// are also included with tents internally but are deliberately left off this list — the client
// was explicit that they don't need to appear as selectable (or advertised) products.
const FREE_GROUNDSHEET = ['Groundsheet'];
const FREE_BEDSHEET = ['Bedsheet'];

export const mockIndividualItems: IndividualItem[] = [
  { id: 'item-tent-2p-black', name: '2P Mobi Garden Tent (Black)', category: 'Tents', pricing: { '48h': 180, '72h': 198 }, depositAmount: 500, imageUrl: '/images/products/tents/2p-mobi-garden-tent-black.png', includedAccessories: FREE_GROUNDSHEET },
  { id: 'item-tent-2p-khaki', name: '2P Mobi Garden Tent (Khaki)', category: 'Tents', pricing: { '48h': 180, '72h': 198 }, depositAmount: 500, imageUrl: '/images/products/tents/2p-mobi-garden-tent-khaki.png', includedAccessories: FREE_GROUNDSHEET },
  {
    id: 'item-tent-4p-vinyl',
    name: '4P Blackdog Vinyl Tent',
    category: 'Tents',
    pricing: { '48h': 250, '72h': 275 },
    depositAmount: 700,
    imageUrl: '/images/products/tents/4p-blackdog-vinyl-tent.png',
    unavailableRanges: [{ start: '2026-08-15', end: '2026-08-17' }],
    includedAccessories: FREE_GROUNDSHEET,
  },
  { id: 'item-tent-8p-starchase', name: '8P Blackdog Starchase 13x', category: 'Tents', pricing: { '48h': 400, '72h': 440 }, depositAmount: 1200, imageUrl: '/images/products/tents/8p-blackdog-starchase-13x.png', includedAccessories: FREE_GROUNDSHEET },
  { id: 'item-tent-8p-village', name: '8P Village 13 Lite', category: 'Tents', pricing: { '48h': 400, '72h': 440 }, depositAmount: 1200, imageUrl: '/images/products/tents/8p-village-13-lite.png', includedAccessories: FREE_GROUNDSHEET },

  { id: 'item-bed-black-20cm-king', name: 'Black 20cm King-Sized Inflatable Bed', category: 'Beds', pricing: { '48h': 100, '72h': 110 }, depositAmount: 300, imageUrl: '/images/products/beds/black-20cm-king-inflatable-bed.png', includedAccessories: FREE_BEDSHEET },
  { id: 'item-bed-black-40cm-king', name: 'Black 40cm King-Sized Inflatable Bed', category: 'Beds', pricing: { '48h': 130, '72h': 143 }, depositAmount: 350, imageUrl: '/images/products/beds/black-40cm-king-inflatable-bed.png', includedAccessories: FREE_BEDSHEET },
  { id: 'item-bed-black-double', name: 'Black Double-Sized Inflatable Bed', category: 'Beds', pricing: { '48h': 90, '72h': 99 }, depositAmount: 250, imageUrl: '/images/products/beds/black-double-inflatable-bed.png', includedAccessories: FREE_BEDSHEET },
  { id: 'item-bed-black-single', name: 'Black Single-Sized Inflatable Bed', category: 'Beds', pricing: { '48h': 70, '72h': 77 }, depositAmount: 200, imageUrl: '/images/products/beds/black-single-inflatable-bed.png', includedAccessories: FREE_BEDSHEET },
  { id: 'item-bed-khaki-40cm-king', name: 'Khaki 40cm King-Sized Inflatable Bed', category: 'Beds', pricing: { '48h': 130, '72h': 143 }, depositAmount: 350, imageUrl: '/images/products/beds/khaki-40cm-king-inflatable-bed.png', includedAccessories: FREE_BEDSHEET },

  { id: 'item-chair-black-moon', name: 'Black Moon Chair', category: 'Camping Chairs', pricing: { '48h': 50, '72h': 55 }, depositAmount: 150, imageUrl: '/images/products/chairs/black-moon-chair.png' },
  { id: 'item-chair-kermit', name: 'Kermit Chair', category: 'Camping Chairs', pricing: { '48h': 60, '72h': 66 }, depositAmount: 150, imageUrl: '/images/products/chairs/kermit-chair.png' },
  { id: 'item-chair-ultralight', name: 'Ultra-Light Chair', category: 'Camping Chairs', pricing: { '48h': 50, '72h': 55 }, depositAmount: 150, imageUrl: '/images/products/chairs/ultra-light-chair.png' },
  { id: 'item-chair-khaki-moon', name: 'Khaki Moon Chair', category: 'Camping Chairs', pricing: { '48h': 50, '72h': 55 }, depositAmount: 150, imageUrl: '/images/products/chairs/khaki-moon-chair.png' },

  { id: 'item-fan-basic-tripod', name: 'Basic Tripod Fan', category: 'Camping Fans', pricing: { '48h': 60, '72h': 66 }, depositAmount: 150, imageUrl: '/images/products/fans/basic-tripod-fan.png' },
  { id: 'item-fan-premium-oscillating', name: 'Premium Oscillating Fan', category: 'Camping Fans', pricing: { '48h': 100, '72h': 110 }, depositAmount: 250, imageUrl: '/images/products/fans/premium-oscillating-fan.png' },
  { id: 'item-fan-tripod', name: 'Tripod Fan', category: 'Camping Fans', pricing: { '48h': 70, '72h': 77 }, depositAmount: 150, imageUrl: '/images/products/fans/tripod-fan.png' },

  { id: 'item-table-black-extralong', name: 'Black Extra-Long Table', category: 'Camping Tables', pricing: { '48h': 100, '72h': 110 }, depositAmount: 250, imageUrl: '/images/products/tables/black-extra-long-table.png' },
  { id: 'item-table-black-large', name: 'Black Large Table', category: 'Camping Tables', pricing: { '48h': 90, '72h': 99 }, depositAmount: 200, imageUrl: '/images/products/tables/black-large-table.png' },
  { id: 'item-table-black-small', name: 'Black Small Table', category: 'Camping Tables', pricing: { '48h': 60, '72h': 66 }, depositAmount: 150, imageUrl: '/images/products/tables/black-small-table.png' },
  { id: 'item-table-khaki-extralong', name: 'Khaki Extra-Long Table', category: 'Camping Tables', pricing: { '48h': 100, '72h': 110 }, depositAmount: 250, imageUrl: '/images/products/tables/khaki-extra-long-table.png' },

  {
    id: 'item-canopy-3x4',
    name: '3x4 Timeless Tarp Canopy',
    category: 'Canopy',
    pricing: { '48h': 150, '72h': 165 },
    depositAmount: 400,
    imageUrl: '/images/products/canopy/3x4-timeless-tarp-canopy.png',
    // Client rule: Extra Canopy Poles is a paid add-on, not a free inclusion or standalone product.
    paidAddOns: [{ id: 'addon-canopy-extra-poles', name: 'Extra Canopy Poles', price: 99, minDurationHours: 0 }],
  },

  { id: 'item-cooler-17l-blackdog', name: '17L BlackDog Cooler', category: 'Coolers', pricing: { '48h': 100, '72h': 110 }, depositAmount: 300, imageUrl: '/images/products/coolers/17l-blackdog-cooler.png' },
  { id: 'item-cooler-18l-naturehike', name: '18L Naturehike Cooler', category: 'Coolers', pricing: { '48h': 110, '72h': 121 }, depositAmount: 300, imageUrl: '/images/products/coolers/18l-naturehike-cooler.png' },

  { id: 'item-light-fairy', name: 'Blackdog Fairy Lights', category: 'Lights', pricing: { '48h': 60, '72h': 66 }, depositAmount: 150, imageUrl: '/images/products/lights/blackdog-fairy-lights.png' },
  { id: 'item-light-lantern', name: 'Mountainhike Camping Lantern', category: 'Lights', pricing: { '48h': 60, '72h': 66 }, depositAmount: 150, imageUrl: '/images/products/lights/mountainhike-camping-lantern.png' },
  { id: 'item-light-basic', name: 'Orashare Camping Light', category: 'Lights', pricing: { '48h': 40, '72h': 44 }, depositAmount: 100, imageUrl: '/images/products/lights/orashare-camping-light.png' },

  { id: 'item-addon-picnic-mat', name: 'Picnic Mat', category: 'Other Add-Ons', pricing: { '48h': 50, '72h': 55 }, depositAmount: 100, imageUrl: '/images/products/other-add-ons/picnic-mat.png' },

  { id: 'item-storage-65l', name: '65L Storage Box', category: 'Storage', pricing: { '48h': 80, '72h': 88 }, depositAmount: 200, imageUrl: '/images/products/storage/65l-storage-box.png' },

  { id: 'item-cooking-lpg-canister', name: '230g LPG Canister', category: 'Cooking', pricing: { '48h': 50, '72h': 55 }, depositAmount: 100, imageUrl: '/images/products/cooking/230g-lpg-canister.png' },
  { id: 'item-cooking-butane-stove', name: 'Motocamp Butane Stove', category: 'Cooking', pricing: { '48h': 100, '72h': 110 }, depositAmount: 250, imageUrl: '/images/products/cooking/motocamp-butane-stove.png' },
  // Client rule: internal brand is "Generic", but that word must never appear customer-facing —
  // `name` is already written clean, `brand` is kept only to mirror the real schema's column
  // (see stripGenericBrand in supabaseCatalog.ts for the equivalent defense against real rows
  // whose `name` literally contains "Generic ..."). Pricing reuses the Motocamp Butane Stove's
  // existing tier as a placeholder — no new final price invented.
  { id: 'item-cooking-big-set', name: 'Big Cooking Set', category: 'Cooking', brand: 'Generic', pricing: { '48h': 100, '72h': 110 }, depositAmount: 250, imageUrl: '' },
  // Client rule: "Generic Small Cooking Set" is not currently available and hasn't been added to
  // inventory yet — deliberately NOT included here (distinct from Wanderer's "visible but out of
  // stock" treatment: this one isn't shown at all). Add it once the client confirms it's stocked.
];
