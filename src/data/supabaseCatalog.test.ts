import { describe, expect, it } from 'vitest';
import { applyPackageSelectability, groupPackageRows, type PackageRow } from './supabaseCatalog';
import type { RmsCatalogPackage } from '../utils/rmsApi';

/**
 * Pins down the package pricing/selectability behaviour fixed in this pass:
 * - a null price48hCentavos/price72hCentavos falls back to the row's own basePriceCentavos (the
 *   same fallback RMS's own customer catalog service applies server-side), never a fabricated ₱0;
 * - each edition gets its OWN price/deposit, resolved from its own row, never inherited from the
 *   primary/first entry;
 * - applyPackageSelectability maps RMS's own canSelect onto isOutOfStock, per kit AND per edition
 *   independently, by packageNumber.
 */

function makeRow(overrides: Partial<PackageRow> = {}): PackageRow {
  return {
    id: 'row-1',
    packageNumber: 'PKG-0001',
    name: 'Nomad Kit',
    description: null,
    price48hCentavos: 249000,
    price72hCentavos: 279000,
    extraPerDayCentavos: 50000,
    depositCentavos: 40000,
    basePriceCentavos: 249000,
    imageStoragePath: null,
    ...overrides,
  };
}

describe('groupPackageRows — pricing', () => {
  it('uses price48hCentavos/price72hCentavos as-is when both are set', () => {
    const [kit] = groupPackageRows([makeRow({ price48hCentavos: 249000, price72hCentavos: 279000, basePriceCentavos: 200000 })]);
    expect(kit.pricing).toEqual({ '48h': 2490, '72h': 2790 });
  });

  it('falls back to basePriceCentavos when price48hCentavos is null, never ₱0', () => {
    const [kit] = groupPackageRows([makeRow({ price48hCentavos: null, price72hCentavos: null, basePriceCentavos: 310000 })]);
    expect(kit.pricing).toEqual({ '48h': 3100, '72h': 3100 });
  });

  it('resolves price48h and price72h independently — one can be null while the other is set', () => {
    const [kit] = groupPackageRows([makeRow({ price48hCentavos: null, price72hCentavos: 340000, basePriceCentavos: 310000 })]);
    expect(kit.pricing).toEqual({ '48h': 3100, '72h': 3400 });
  });
});

describe('groupPackageRows — edition pricing/deposit', () => {
  it('gives each edition its own price and deposit, not the primary/first row\'s values', () => {
    const rows: PackageRow[] = [
      makeRow({
        id: 'row-black',
        packageNumber: 'PKG-0003',
        name: 'Base Camper Kit (Black)',
        price48hCentavos: 569000,
        price72hCentavos: 621000,
        depositCentavos: 90000,
        basePriceCentavos: 569000,
      }),
      makeRow({
        id: 'row-khaki',
        packageNumber: 'PKG-0004',
        name: 'Base Camper Kit (Khaki)',
        price48hCentavos: 599000,
        price72hCentavos: 651000,
        depositCentavos: 95000,
        basePriceCentavos: 599000,
      }),
    ];

    const [kit] = groupPackageRows(rows);
    expect(kit.editions).toHaveLength(2);

    const black = kit.editions?.find((e) => e.packageNumber === 'PKG-0003');
    const khaki = kit.editions?.find((e) => e.packageNumber === 'PKG-0004');

    expect(black?.pricing).toEqual({ '48h': 5690, '72h': 6210 });
    expect(black?.depositAmount).toBe(900);
    expect(khaki?.pricing).toEqual({ '48h': 5990, '72h': 6510 });
    expect(khaki?.depositAmount).toBe(950);

    // The kit-level (primary/first-row) pricing must never silently become the answer for the
    // second edition — Khaki's own price must differ from what the kit-level fields show.
    expect(kit.pricing).toEqual({ '48h': 5690, '72h': 6210 });
    expect(khaki?.pricing).not.toEqual(kit.pricing);
  });

  it('resolves each edition\'s own null price48hCentavos against its OWN basePriceCentavos, not the primary row\'s', () => {
    const rows: PackageRow[] = [
      makeRow({ id: 'row-black', packageNumber: 'PKG-0003', name: 'Kit (Black)', price48hCentavos: 100000, basePriceCentavos: 100000 }),
      makeRow({ id: 'row-khaki', packageNumber: 'PKG-0004', name: 'Kit (Khaki)', price48hCentavos: null, price72hCentavos: null, basePriceCentavos: 150000 }),
    ];
    const [kit] = groupPackageRows(rows);
    const khaki = kit.editions?.find((e) => e.packageNumber === 'PKG-0004');
    expect(khaki?.pricing).toEqual({ '48h': 1500, '72h': 1500 });
  });
});

function makeRmsPackage(overrides: Partial<RmsCatalogPackage> = {}): RmsCatalogPackage {
  return {
    packageNumber: 'PKG-0001',
    name: 'Nomad Kit',
    description: null,
    price48hCentavos: 249000,
    price72hCentavos: 279000,
    extraPerDayCentavos: 50000,
    depositCentavos: 40000,
    imageUrl: null,
    components: [],
    canSelect: true,
    compatibleAddOns: [],
    ...overrides,
  };
}

describe('applyPackageSelectability', () => {
  it('marks a kit selectable (isOutOfStock: false) when RMS reports canSelect: true', () => {
    const [kit] = groupPackageRows([makeRow({ packageNumber: 'PKG-0001' })]);
    const [enriched] = applyPackageSelectability([kit], [makeRmsPackage({ packageNumber: 'PKG-0001', canSelect: true })]);
    expect(enriched.isOutOfStock).toBe(false);
  });

  it('marks a kit out of stock when RMS reports canSelect: false', () => {
    const [kit] = groupPackageRows([makeRow({ packageNumber: 'PKG-0001' })]);
    const [enriched] = applyPackageSelectability([kit], [makeRmsPackage({ packageNumber: 'PKG-0001', canSelect: false })]);
    expect(enriched.isOutOfStock).toBe(true);
  });

  it('applies canSelect per edition independently — one edition can be out of stock while its sibling is not', () => {
    const rows: PackageRow[] = [
      makeRow({ id: 'row-black', packageNumber: 'PKG-0003', name: 'Kit (Black)' }),
      makeRow({ id: 'row-khaki', packageNumber: 'PKG-0004', name: 'Kit (Khaki)' }),
    ];
    const [kit] = groupPackageRows(rows);
    const [enriched] = applyPackageSelectability(
      [kit],
      [
        makeRmsPackage({ packageNumber: 'PKG-0003', canSelect: true }),
        makeRmsPackage({ packageNumber: 'PKG-0004', canSelect: false }),
      ],
    );
    const black = enriched.editions?.find((e) => e.packageNumber === 'PKG-0003');
    const khaki = enriched.editions?.find((e) => e.packageNumber === 'PKG-0004');
    expect(black?.isOutOfStock).toBe(false);
    expect(khaki?.isOutOfStock).toBe(true);
  });

  it('leaves isOutOfStock unchanged when RMS has no entry for a packageNumber, rather than guessing', () => {
    const [kit] = groupPackageRows([makeRow({ packageNumber: 'PKG-9999' })]);
    const [enriched] = applyPackageSelectability([kit], [makeRmsPackage({ packageNumber: 'PKG-0001' })]);
    expect(enriched.isOutOfStock).toBe(kit.isOutOfStock);
  });
});
