import { ArrowRightIcon } from './icons';

/**
 * The arrow from one "how it works" step card to the next (homepage and About Us), centered in the
 * gap after its card: below it pointing down while the cards stack (phones), beside it pointing
 * right once they sit in a row. The card must be `relative`, and the grid sets the gap as
 * STEP_GRID_GAP so the arrow knows where the middle of the gap is. `skipOnTwoColumns` hides it on
 * the two-column tablet layout for the card that ends the first row, since the next step starts a
 * new row there and a right or down arrow would point at the wrong card.
 */
export const STEP_GRID_GAP = '[--step-gap:2.5rem] gap-[var(--step-gap)] sm:[--step-gap:3rem]';

export default function StepArrow({ skipOnTwoColumns = false }: { skipOnTwoColumns?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-1/2 top-[calc(100%+var(--step-gap)/2)] z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-accent shadow-sm sm:left-[calc(100%+var(--step-gap)/2)] sm:top-1/2 ${
        skipOnTwoColumns ? 'sm:hidden lg:flex' : ''
      }`}
    >
      <ArrowRightIcon className="h-4 w-4 rotate-90 sm:rotate-0" />
    </span>
  );
}
