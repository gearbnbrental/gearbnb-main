import { useState } from 'react';
import { parseQuantityPrefix, parsePackageContentsFromText } from '../utils/packageContents';
import type { PackageKit } from '../types/gearbnb';

interface PackageContentsProps {
  kit: Pick<PackageKit, 'includedItems' | 'description'>;
}

/** Above this many rows, the list collapses by default — a package with 7-8 inclusions was making
 * every card on the mobile catalog unnecessarily tall (Part 5: "included items should be
 * expandable/collapsible if the list is long"). Below this count there's nothing worth collapsing. */
const COLLAPSE_THRESHOLD = 4;

/**
 * Renders a package's description and/or "What's Included" list — shared by every place a
 * package is shown (PathACatalog's PackageCard, LandingPage's bundle preview) so this decision
 * never has to be duplicated or drift between them.
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
export default function PackageContents({ kit }: PackageContentsProps) {
  const [expanded, setExpanded] = useState(false);
  const hasStructuredItems = kit.includedItems.length > 0;
  const items = hasStructuredItems
    ? kit.includedItems.map(parseQuantityPrefix)
    : parsePackageContentsFromText(kit.description);

  // The description string IS the item list once it's been parsed out of it — showing both would
  // just repeat the same content twice, once as the broken run-on original.
  const showDescriptionProse = hasStructuredItems || items.length === 0;

  const isLongList = items.length > COLLAPSE_THRESHOLD;
  const visibleItems = isLongList && !expanded ? items.slice(0, COLLAPSE_THRESHOLD) : items;

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
          {isLongList && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="self-start text-xs font-semibold text-accent underline underline-offset-2"
            >
              {expanded ? 'Show less' : `Show all ${items.length} items`}
            </button>
          )}
        </div>
      )}
    </>
  );
}
