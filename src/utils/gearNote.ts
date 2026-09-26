const GAZLITE_LPG_CAN_NOTE = 'Note: Please do not dispose after use. This is refillable, extra charges may occur if not returned.';

/**
 * A short staff-written line shown in place of the "Best for ..." tagline for a product that has
 * none of its own. The RMS description always wins: this only fills the gap, so writing a
 * "Best for" first line in the RMS for one of these products replaces the note automatically.
 */
export function productNote(kind: { category: string; brand: string; model: string | null }): string | null {
  if (kind.category.trim().toLowerCase() === 'cooking' && kind.brand.trim().toLowerCase() === 'gazlite' && (kind.model ?? '').toLowerCase().includes('lpg can')) {
    return GAZLITE_LPG_CAN_NOTE;
  }
  return null;
}
