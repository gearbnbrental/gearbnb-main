import type { BookableGearKind } from '../types/gearbnb';

/**
 * The RMS's My Bookings response currently names a booked add-on by its brand and category
 * ("Blackdog Other Gear Essentials") instead of its own model ("Blackdog Camping Hammer"), even
 * though the booking was submitted with the model. Until that's fixed on the RMS side, this
 * recovers the real name from the live catalog — but only when exactly one catalog add-on has that
 * brand and category, so it never guesses between two. Anything else is returned unchanged.
 */
export function resolveAddOnDisplayName(name: string, gearKinds: BookableGearKind[]): string {
  const candidates = new Set<string>();
  for (const kind of gearKinds) {
    for (const addOn of kind.compatibleAddOns) {
      const brand = addOn.brand.trim();
      const generic = brand ? `${brand} ${addOn.category}` : addOn.category;
      if (generic.toLowerCase() === name.trim().toLowerCase() && addOn.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
        candidates.add(addOn.name);
      }
    }
  }
  return candidates.size === 1 ? [...candidates][0] : name;
}
