import { useState } from 'react';
import { parseQuantityPrefix, parsePackageContentsFromText } from '../utils/packageContents';
import type { PackageKit } from '../types/gearbnb';

interface PackageContentsProps {
  kit: Pick<PackageKit, 'includedItems' | 'description'>;
  /** Below `sm`, replaces the description + up-to-4-items preview with a single collapsed toggle
   *  ("What's Included") that reveals the full description and item list on tap. A 2-column mobile
   *  catalog card has roughly half the width a single-column card had — showing a description
   *  paragraph plus several list items by default was, on its own, the largest remaining
   *  contributor to mobile card height. Nothing is removed, just deferred behind one tap; `sm` and
   *  up render exactly the original behavior, unchanged. */
  compactOnMobile?: boolean;
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
export default function PackageContents({ kit, compactOnMobile = false }: PackageContentsProps) {
  const [expanded, setExpanded] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const hasStructuredItems = kit.includedItems.length > 0;
  const items = hasStructuredItems
    ? kit.includedItems.map(parseQuantityPrefix)
    : parsePackageContentsFromText(kit.description);

  // The description string IS the item list once it's been parsed out of it — showing both would
  // just repeat the same content twice, once as the broken run-on original.
  const showDescriptionProse = hasStructuredItems || items.length === 0;

  const isLongList = items.length > COLLAPSE_THRESHOLD;
  const visibleItems = isLongList && !expanded ? items.slice(0, COLLAPSE_THRESHOLD) : items;

  const body = (
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

  if (!compactOnMobile) return body;

  const hasAnyContent = (showDescriptionProse && Boolean(kit.description)) || items.length > 0;
  if (!hasAnyContent) return null;

  return (
    <>
      {/* Below `sm` only — collapsed by default; see this prop's own doc comment. Tapping shows
          every item at once (no separate "show all" needed once the customer already opted in). */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          aria-expanded={mobileExpanded}
          className="flex items-center gap-1 text-[11px] font-semibold text-accent underline-offset-2 hover:underline"
        >
          {mobileExpanded ? 'Hide details' : "What's included"}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-3 w-3 shrink-0 transition-transform ${mobileExpanded ? 'rotate-180' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {mobileExpanded && (
          <div className="mt-1.5 flex flex-col gap-1.5">
            {showDescriptionProse && kit.description && <p className="text-xs text-ink-muted">{kit.description}</p>}
            {items.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-ink-muted">
                {items.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="flex items-baseline gap-1.5">
                    <span className="w-6 shrink-0 text-right font-medium text-ink [font-variant-numeric:tabular-nums]">
                      {item.quantity}×
                    </span>
                    <span className="min-w-0">{item.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="hidden sm:block">{body}</div>
    </>
  );
}
