import { parseQuantityPrefix, parsePackageContentsFromText } from '../utils/packageContents';
import type { PackageKit } from '../types/gearbnb';

interface PackageContentsProps {
  kit: Pick<PackageKit, 'includedItems' | 'description'>;
  /** Shows every item with no cap. Its only caller today, the "View Details" popup
   *  (PackageDetailsDialog), always passes this — that popup IS the full view, so truncating it
   *  further would make no sense. Defaults to false (capped at COLLAPSE_THRESHOLD) for a future
   *  caller that only wants a short preview. */
  showAllItems?: boolean;
}

/** Above this many rows, the list is capped when `showAllItems` is false. */
const COLLAPSE_THRESHOLD = 4;

/**
 * Renders a package's description and/or "What's Included" list. Lives only inside the "View
 * Details" popup (PackageDetailsDialog) — the catalog card itself no longer shows this at all; it
 * shows the package's own "Best for ..." tagline instead (see splitBestForLine, used directly by
 * PathACatalog's PackageCard).
 *
 * Prefers the catalog's own structured `includedItems` array when it's populated (currently mock
 * data only — the real `packages` table has no such column yet). When it's empty, this looks for
 * the same "<qty>x <name>" shape repeated inside the plain-text `description` instead: on live
 * data the full inclusions list sometimes ends up typed as one continuous description string
 * (e.g. "1x 4 Person Blackdog Vinyl Tent 1x Groundsheet 1x Camping Fan ..."), which is exactly
 * what looked like "one long poorly-aligned string" before this component existed. If the
 * description doesn't reliably match that shape (an ordinary one-off marketing blurb), it's left
 * completely alone and shown as plain prose, same as before.
 */
export default function PackageContents({ kit, showAllItems = false }: PackageContentsProps) {
  const hasStructuredItems = kit.includedItems.length > 0;
  const items = hasStructuredItems
    ? kit.includedItems.map(parseQuantityPrefix)
    : parsePackageContentsFromText(kit.description);

  // The description string IS the item list once it's been parsed out of it — showing both would
  // just repeat the same content twice, once as the broken run-on original.
  const showDescriptionProse = hasStructuredItems || items.length === 0;

  const isLongList = !showAllItems && items.length > COLLAPSE_THRESHOLD;
  const visibleItems = isLongList ? items.slice(0, COLLAPSE_THRESHOLD) : items;

  return (
    <>
      {showDescriptionProse && kit.description && <p className="text-sm text-ink-muted">{kit.description}</p>}

      {items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">What's Included</p>
          <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
            {visibleItems.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex items-baseline gap-2">
                <span className="w-7 shrink-0 text-right font-medium text-ink [font-variant-numeric:tabular-nums]">
                  {item.quantity}×
                </span>
                <span className="min-w-0">{item.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
