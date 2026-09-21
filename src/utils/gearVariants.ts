import type { BookableGearKind } from '../types/gearbnb';

/**
 * Resolves a Build Your Own gear kind to ONE of its color variants — the shape that actually goes
 * into the cart and into the booking/availability payloads. The variant's own photo, stock and
 * (only when the RMS reported one) price replace the kind-wide values; `variants` is dropped so a
 * cart line never carries the whole list, and `color` is set so the line has its own identity (see
 * byoGearKey). The name gets the color appended, matching the RMS's own availability-issue name
 * (`Model (Color)`), so an issue can be matched back to this exact line.
 *
 * Returns the kind unchanged when it has no such variant (e.g. an older RMS, or a color that has
 * since been removed) — never a guessed color.
 */
export function resolveGearVariant(kind: BookableGearKind, color: string | undefined): BookableGearKind {
  const variant = color ? kind.variants?.find((v) => v.color === color) : undefined;
  if (!variant) return kind;

  const { variants: _variants, ...rest } = kind;
  return {
    ...rest,
    color: variant.color,
    name: `${kind.name} (${variant.color})`,
    imageUrl: variant.imageUrl ?? kind.imageUrl,
    quantity: variant.quantity,
    availableCount: variant.availableCount,
    canSelect: variant.canSelect,
    pricing: variant.pricing ?? kind.pricing,
    extraPerDayPrice: variant.extraPerDayPrice ?? kind.extraPerDayPrice,
    sizeCapacity: variant.sizeCapacity ?? kind.sizeCapacity,
  };
}

/** One entry per color for a multi-color kind (the kind itself is replaced by its colors); kinds
 * without variants pass through unchanged. For display-only lists, such as the homepage preview,
 * that should show every color as its own card. */
export function splitKindsByColor(kinds: readonly BookableGearKind[]): BookableGearKind[] {
  return kinds.flatMap((kind) =>
    kind.variants && kind.variants.length > 0 ? kind.variants.map((v) => resolveGearVariant(kind, v.color)) : [kind],
  );
}

/** Every selectable gear "line" the catalog can produce: each kind as-is, plus one resolved entry
 * per color variant. Used to re-match a cart line (which may be color-specific) against the live
 * catalog — see REVALIDATE_AGAINST_CATALOG. */
export function expandGearKinds(kinds: readonly BookableGearKind[]): BookableGearKind[] {
  return kinds.flatMap((kind) => [kind, ...(kind.variants ?? []).map((v) => resolveGearVariant(kind, v.color))]);
}

/** Categories whose "Size / Capacity" is worth showing to customers — it tells them how many people
 * a tent or bed fits. Other gear may carry the field in the RMS, but it isn't shown. */
const SIZE_CAPACITY_CATEGORIES = new Set(['tent', 'bed']);

/** The size/capacity text to show on a gear card, or null: only for Tents and Beds, and only when
 * the RMS actually has a value. */
export function sizeCapacityToShow(kind: Pick<BookableGearKind, 'category' | 'sizeCapacity'>): string | null {
  const value = kind.sizeCapacity?.trim();
  return value && SIZE_CAPACITY_CATEGORIES.has(kind.category.trim().toLowerCase()) ? value : null;
}
