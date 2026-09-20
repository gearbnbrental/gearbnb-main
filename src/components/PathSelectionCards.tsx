import { Link } from 'react-router-dom';
import { ArrowRightIcon, GearPlaceholderIcon } from './icons';

interface PathCardProps {
  to: string;
  title: string;
  /** Smaller supporting text — deliberately rendered BELOW the H3 title, not above it, per the
   *  client's explicit content/layout request. */
  subtitle: string;
  description: string;
  cta: string;
  image: string;
}

/**
 * One "gear up" choice — image, title, then the shorter subtitle line, then the longer
 * description, then the CTA. `h-full` + the parent grid's `items-stretch` (the grid's default)
 * keeps both cards the same height regardless of which description happens to be longer; `mt-auto`
 * on the CTA pins it to the bottom of both cards so the two buttons always align with each other
 * even when the text above them doesn't take up equal space.
 */
function PathCard({ to, title, subtitle, description, cta, image }: PathCardProps) {
  return (
    <Link
      to={to}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-all hover:border-brand-forest/40 hover:shadow-md"
    >
      {/* aspect-square below sm, not aspect-video: this component renders in a 2-column grid even
          on the narrowest phone (see PathSelectionCards below) specifically so the two paths can
          be compared side by side without scrolling — a mobile catalog chooser or homepage section
          showing only one giant stacked option at a time defeats that. A ~175px-wide column at
          16:9 was still noticeably taller than it needed to be for a comparison card; square keeps
          the photo recognizable while giving title/subtitle/CTA more of the column's own height.
          sm:aspect-[16/10] keeps the desktop crop exactly as it was. */}
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-surface-strong sm:aspect-[16/10]">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <GearPlaceholderIcon className="h-12 w-12 text-ink-faint" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:gap-2 sm:p-7">
        <h3 className="font-serif text-sm font-bold leading-snug text-ink sm:text-2xl">{title}</h3>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-accent sm:text-sm">{subtitle}</p>
        {/* line-clamp-1 below sm (was line-clamp-2): a 2-column comparison card has roughly half
            the width a single stacked card did, so even 2 lines of body text pushed the CTA below
            the fold of a card that's supposed to read at a glance. Untouched (full text, no clamp)
            from sm up, where there's room for it. */}
        <p className="line-clamp-1 text-xs text-ink-muted sm:line-clamp-none sm:text-base">{description}</p>
        {/* The CTA text sits on a solid dark-green oblong "pill" rather than in a filled
            rectangular button — still a decorative layer, per the client's request, not a new
            control. The ellipse is aria-hidden and purely visual; the Link wrapping this whole
            card is still the only thing that's interactive, so click behaviour, routing and focus
            are all unchanged.

            bg-brand-forest-dark (the same existing dark-green token already used site-wide for
            hover states on primary buttons, e.g. hover:bg-brand-forest-dark) — reused here as a
            solid background per the client's "dark green layer, white text" request, rather than
            introducing a new green. It stays constant across light/dark mode (unlike `accent`,
            which brightens in dark mode), so white text on it keeps full contrast in either theme
            with no per-theme override needed.

            The arrow icon now lives INSIDE the same relative/positioned wrapper as the label
            (previously it sat outside the oblong, colored by the outer span) — the absolute
            oblong sizes itself off this wrapper's content box, so it needs to actually contain
            the arrow for the pill to visually cover it. Flipping only the outer span to white
            without this change would have left a white arrow floating on the plain page
            background outside the pill, invisible against it. */}
        <span className="mt-auto flex items-center pt-1.5 sm:pt-4">
          <span className="relative inline-flex items-center gap-1.5 sm:gap-2">
            <span
              aria-hidden="true"
              className="absolute -inset-x-2.5 -inset-y-1.5 rounded-full bg-brand-forest-dark transition-transform duration-300 ease-out group-hover:scale-105 sm:-inset-x-3.5 sm:-inset-y-2"
            />
            <span className="relative text-xs font-semibold text-white sm:text-sm">{cta}</span>
            <ArrowRightIcon className="relative h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
          </span>
        </span>
      </div>
    </Link>
  );
}

export default function PathSelectionCards() {
  return (
    // grid-cols-2 at every width (not stacked below sm): this is a direct comparison between
    // exactly two choices — stacking them means only one is ever visible without scrolling, which
    // defeats the comparison this component exists to support (used on both the homepage's "How
    // Do You Want to Gear Up?" section and the dedicated /catalog chooser page).
    <div className="grid grid-cols-2 gap-2.5 sm:gap-6">
      <PathCard
        to="/catalog/camping-packages"
        title="Choose a Package"
        subtitle="Pre-Selected Kits"
        description="Not sure what gear you need? We've put together ready-to-rent kits with quality gear, so you can spend less time researching and more time planning your trip."
        cta="Explore Packages"
        // The client's actual "Choose Package" photo — same optimized file already registered in
        // the Camp Setups gallery (see campSetups.ts's 'choose-package-camp-setup' entry).
        image="/images/camp-setups/choose-package-camp-setup.jpg"
      />
      <PathCard
        to="/catalog/build-your-own"
        title="Build Your Own Kit"
        subtitle="Fully Custom"
        description="Pick your rental duration, then mix and match individual gear by category to fit your trip exactly."
        cta="Start Building"
        // The client's actual "BYO" photo — same file already registered in the Camp Setups
        // gallery as 'byo-camp-setup'.
        image="/images/camp-setups/byo-camp-setup.jpg"
      />
    </div>
  );
}
