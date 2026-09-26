/** What the page-level "which packages are free for these dates" lookup currently knows. */
export type PackageDateStock =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; canSelect: ReadonlyMap<string, boolean> }
  | { status: 'failed' };

/**
 * How one package card gets its availability:
 *  - 'own':       run the card's own availability check (as always).
 *  - 'available': the batch lookup says it's free, so show that without a request.
 *  - 'checking':  the batch lookup is still on its way, so wait for it instead of firing a request.
 *
 * The batch answer is only ever trusted when it says a package IS available. Anything else (it said
 * no, doesn't know the package, failed, or there's nothing to check yet) goes to the card's own
 * check, which gives the exact reasons. A selected package always runs its own check, because that
 * one includes the extras attached to it, and so does one the plain stock snapshot calls out of stock
 * (see `snapshotOutOfStock`).
 */
export function decidePackageCheck(
  stock: PackageDateStock,
  packageCode: string,
  isSelected: boolean,
  snapshotOutOfStock = false,
): 'own' | 'available' | 'checking' {
  if (isSelected) return 'own';
  if (stock.status === 'loading') return 'checking';
  // A package the "free right now" snapshot calls out of stock but the dates call free is the one
  // case where the two disagree, so it gets the precise check instead of the lookup's word alone.
  if (stock.status === 'ready' && stock.canSelect.get(packageCode) === true && !snapshotOutOfStock) return 'available';
  return 'own';
}
