import { describe, expect, it } from 'vitest';
import { depositExplanation, depositTierCentavos, depositTierLabel, requiredDeposit } from './securityDeposit';

describe('depositTierCentavos', () => {
  it.each([
    [0, 30_000],
    [99_999, 30_000],
    [100_000, 50_000],
    [399_999, 50_000],
    [400_000, 90_000],
    [600_000, 90_000],
    [600_001, 120_000],
    [2_000_000, 120_000],
  ])('rental %i centavos -> deposit %i', (rental, deposit) => {
    expect(depositTierCentavos(rental)).toBe(deposit);
  });
});

describe('requiredDeposit', () => {
  it('Build Your Own pays the tier', () => {
    expect(requiredDeposit({ packageDepositCentavos: null, hasExtras: false, rentalBeforePromoCentavos: 450_000 })).toEqual({
      depositCentavos: 90_000,
      reason: 'TIER',
    });
  });

  it('a package on its own keeps its own deposit, even above ₱6,000 (Base Camper 72h)', () => {
    expect(requiredDeposit({ packageDepositCentavos: 90_000, hasExtras: false, rentalBeforePromoCentavos: 610_000 })).toEqual({
      depositCentavos: 90_000,
      reason: 'PACKAGE',
    });
  });

  it('a package whose add-ons push the total up pays the higher tier (Nomad + add-ons = ₱7,000)', () => {
    expect(requiredDeposit({ packageDepositCentavos: 50_000, hasExtras: true, rentalBeforePromoCentavos: 700_000 })).toEqual({
      depositCentavos: 120_000,
      reason: 'TIER',
    });
  });

  it('a package deposit higher than the tier is kept (Traveler ₱1,300)', () => {
    expect(requiredDeposit({ packageDepositCentavos: 130_000, hasExtras: true, rentalBeforePromoCentavos: 900_000 })).toEqual({
      depositCentavos: 130_000,
      reason: 'PACKAGE',
    });
  });

  it('a package with extras whose tier is lower keeps the package deposit', () => {
    expect(requiredDeposit({ packageDepositCentavos: 50_000, hasExtras: true, rentalBeforePromoCentavos: 300_000 }).depositCentavos).toBe(
      50_000,
    );
  });
});

describe('depositTierLabel', () => {
  it.each([
    [99_999, 'for rentals below ₱1,000'],
    [100_000, 'for rentals from ₱1,000 to below ₱4,000'],
    [600_000, 'for rentals from ₱4,000 to ₱6,000'],
    [600_001, 'for rentals above ₱6,000'],
  ])('%i -> %s', (rental, label) => {
    expect(depositTierLabel(rental)).toBe(label);
  });
});

describe('depositExplanation', () => {
  it('explains a Build Your Own tier', () => {
    expect(depositExplanation({ depositCentavos: 90_000, reason: 'TIER', packageDepositCentavos: null, rentalBeforePromoCentavos: 420_000 })).toBe(
      '₱900 deposit for rentals from ₱4,000 to ₱6,000 (your rental: ₱4,200).',
    );
  });

  it('explains a package deposit raised by its add-ons', () => {
    expect(depositExplanation({ depositCentavos: 120_000, reason: 'TIER', packageDepositCentavos: 50_000, rentalBeforePromoCentavos: 700_000 })).toBe(
      "Your add-ons bring the rental to ₱7,000, so the deposit is ₱1,200 instead of the package's ₱500.",
    );
  });

  it("says nothing extra for a package's own deposit", () => {
    expect(depositExplanation({ depositCentavos: 90_000, reason: 'PACKAGE', packageDepositCentavos: 90_000, rentalBeforePromoCentavos: 610_000 })).toBeNull();
  });
});
