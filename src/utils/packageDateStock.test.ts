import { describe, expect, it } from 'vitest';
import { decidePackageCheck, type PackageDateStock } from './packageDateStock';

const ready = (entries: [string, boolean][]): PackageDateStock => ({ status: 'ready', canSelect: new Map(entries) });

describe('decidePackageCheck', () => {
  it('shows available without a request only when the batch says available', () => {
    expect(decidePackageCheck(ready([['PKG-1', true]]), 'PKG-1', false)).toBe('available');
  });
  it('sends an unavailable or unknown package to its own check for the exact reasons', () => {
    expect(decidePackageCheck(ready([['PKG-1', false]]), 'PKG-1', false)).toBe('own');
    expect(decidePackageCheck(ready([['PKG-2', true]]), 'PKG-1', false)).toBe('own');
  });
  it('falls back to the own check when the batch failed or there is nothing to check yet', () => {
    expect(decidePackageCheck({ status: 'failed' }, 'PKG-1', false)).toBe('own');
    expect(decidePackageCheck({ status: 'idle' }, 'PKG-1', false)).toBe('own');
  });
  it('waits while the batch is loading instead of firing a request', () => {
    expect(decidePackageCheck({ status: 'loading' }, 'PKG-1', false)).toBe('checking');
  });
  it('always runs the own check for a package already in the cart, whatever the batch says', () => {
    expect(decidePackageCheck(ready([['PKG-1', true]]), 'PKG-1', true)).toBe('own');
    expect(decidePackageCheck({ status: 'loading' }, 'PKG-1', true)).toBe('own');
  });
});
