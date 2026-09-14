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
      <div className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden bg-surface-strong">
        {image ? (
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <GearPlaceholderIcon className="h-12 w-12 text-ink-faint" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-6 sm:p-7">
        <h3 className="font-serif text-xl font-bold text-ink sm:text-2xl">{title}</h3>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">{subtitle}</p>
        <p className="text-sm text-ink-muted sm:text-base">{description}</p>
        {/* The CTA text sits on a soft green oblong "highlight" rather than in a filled rectangular
            button — a decorative layer, per the client's request, not a new control. The ellipse is
            aria-hidden and purely visual; the Link wrapping this whole card is still the only thing
            that's interactive, so click behaviour, routing and focus are all unchanged.

            Both the oblong and the label are positioned, and the label comes second in source
            order, so the text always paints on top without needing a negative z-index that could
            slip behind the card's own background.

            text-brand-forest (a literal dark green), not text-accent — per the client's explicit
            "make this text dark green" request. The oblong behind it is brightened in dark mode
            (see bg-brand-olive/60 below, up from /50) specifically so dark green text sitting on
            top of it stays readable there too, rather than switching the text itself to a lighter
            shade. */}
        <span className="mt-auto flex items-center gap-2 pt-4 text-sm font-semibold text-brand-forest transition-colors group-hover:text-brand-forest-dark">
          <span className="relative inline-flex items-center justify-center">
            <span
              aria-hidden="true"
              className="absolute -inset-x-3.5 -inset-y-2 rounded-full bg-brand-olive/35 transition-transform duration-300 ease-out group-hover:scale-105 dark:bg-brand-olive/60"
            />
            <span className="relative">{cta}</span>
          </span>
          <ArrowRightIcon className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

export default function PathSelectionCards() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <PathCard
        to="/catalog/path-a"
        title="Choose a Package"
        subtitle="Pre-Selected Kits"
        description="Not sure what gear you need? We've put together ready-to-rent kits with quality gear, so you can spend less time researching and more time planning your trip."
        cta="Explore Packages"
        // The client's actual "Choose Package" photo — same optimized file already registered in
        // the Camp Setups gallery (see campSetups.ts's 'choose-package-camp-setup' entry).
        image="/images/camp-setups/choose-package-camp-setup.jpg"
      />
      <PathCard
        to="/catalog/path-b"
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
