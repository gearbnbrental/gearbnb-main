import type { BookableGearKind, PackageComponent } from '../types/gearbnb';
import { addOnAsGearKind } from './addOnAsKind';

const componentKey = (c: { category: string; brand: string; model: string | null }) => `${c.category}|${c.brand}|${c.model ?? ''}`;

/**
 * Resolves one of a package's real components (see PackageComponent's own doc comment) to its own
 * full, displayable product — the same category+brand+model key the RMS itself groups gear kinds
 * by, so this is a real match, never a guess off free text. Looks in two places, since a component
 * can be either:
 *   - a top-level browsable gear kind (a Tent, Bed, Chair, Table, Fan, ...), or
 *   - a kind that's ONLY reachable as another kind's compatible add-on (e.g. "Blackdog Camping
 *     Hammer" — moved off independent browsing onto every Tent's own add-on list). Checked across
 *     every top-level kind's `compatibleAddOns`, converted via addOnAsGearKind for display.
 *
 * Returns undefined for a component the customer catalog has no product page for at all (a
 * Groundsheet, Peg, Rope, Bedsheet, ...) — those are real inventory, just never independently
 * photographed/described, so this never fabricates a page for them; the caller shows plain text.
 */
export function matchComponentToGearKind(component: PackageComponent, gearKinds: readonly BookableGearKind[]): BookableGearKind | undefined {
  const key = componentKey(component);
  const topLevel = gearKinds.find((kind) => componentKey(kind) === key);
  if (topLevel) return topLevel;

  for (const kind of gearKinds) {
    const addOn = kind.compatibleAddOns.find((a) => componentKey(a) === key);
    if (addOn) return addOnAsGearKind(addOn);
  }
  return undefined;
}
