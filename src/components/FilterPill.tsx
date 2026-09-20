import type { ReactNode } from 'react';

/**
 * The single selectable-option control shared by every duration/filter pill on the catalog pages
 * (PathACatalog's Group Size and Rental Duration rows, PathBCatalog's Rental Duration row). These
 * used to each hand-roll their own near-identical button — different padding, no `aria-pressed`,
 * subtly different unselected-state styling — which is how they drifted out of visual and
 * behavioral sync with one another. One component means one size, one selected state, and one
 * focus ring everywhere it's used.
 *
 * `h-9` gives every pill the same height whether or not it also carries a promo badge, and keeps
 * the tap target comfortable on mobile. `aria-pressed` is what actually communicates the selected
 * state to a screen reader — colour alone never does.
 */
export default function FilterPill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/40 ${
        selected
          ? 'bg-brand-forest text-white shadow-sm'
          : 'border border-line bg-surface text-ink-muted hover:bg-surface-strong hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
