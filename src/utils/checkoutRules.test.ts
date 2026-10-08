import { describe, expect, it } from 'vitest';
import type { BookableGearSelection, IndividualItem, PackageKit } from '../types/gearbnb';
import { checkoutBlocker } from './checkoutRules';

const kit = { id: 'k1' } as PackageKit;
const kit2 = { id: 'k2' } as PackageKit;
const gear = { category: 'Tent' } as BookableGearSelection;
const empty = { selectedKits: [], selectedItems: [], byoGears: [], kitExtras: {} };

describe('checkoutBlocker', () => {
  it('lets a single package, or a Build Your Own selection, through', () => {
    expect(checkoutBlocker({ ...empty, selectedKits: [kit] })).toBeNull();
    expect(checkoutBlocker({ ...empty, byoGears: [gear, gear] })).toBeNull();
  });
  it('stops a package combined with Build Your Own gear', () => {
    expect(checkoutBlocker({ ...empty, selectedKits: [kit], byoGears: [gear] })).toMatch(/Package or Build Your Own, not both/);
  });
  it('stops more than one package', () => {
    expect(checkoutBlocker({ ...empty, selectedKits: [kit, kit2] })).toMatch(/one package at a time/);
  });
  it('stops old-style items and old-style package extras', () => {
    expect(checkoutBlocker({ ...empty, selectedItems: [{ id: 'i' } as IndividualItem] })).toMatch(/added the old way/);
    expect(checkoutBlocker({ ...empty, selectedKits: [kit], kitExtras: { k1: ['x'] } })).toMatch(/Package extras/);
  });
});
