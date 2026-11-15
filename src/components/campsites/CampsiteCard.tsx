import { Link } from 'react-router-dom';
import type { CampsiteSummary } from '../../types/campsite';
import { campsiteHighlights, campsitePath, driveTimeText, headlineFee, placeName } from '../../utils/campsites';
import { estimateDriveMinutes, type Place } from '../../utils/travel';
import { MapPinIcon } from '../icons';
import { StarRating } from './StarRating';

/** One campsite in a list: photo, name, place, rating, highlights and fee, linking to its page. */
export default function CampsiteCard({
  campsite,
  headingLevel: Heading = 'h2',
  onHover,
  from = null,
}: {
  campsite: CampsiteSummary;
  /** The camper's starting point: the card then shows the estimated drive from there. */
  from?: Place | null;
  headingLevel?: 'h2' | 'h3';
  /** Called with the slug while the card is hovered or focused, and null after (for the map). */
  onHover?: (slug: string | null) => void;
}) {
  const fee = headlineFee(campsite).text;
  const drive = from
    ? `${driveTimeText(estimateDriveMinutes(from, campsite))} from you`
    : driveTimeText(campsite.driveMinutesFromLasPinas) && `${driveTimeText(campsite.driveMinutesFromLasPinas)} from Las Piñas`;
  const highlights = campsiteHighlights(campsite).slice(0, 3);

  return (
    <Link
      to={campsitePath(campsite)}
      onMouseEnter={() => onHover?.(campsite.slug)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(campsite.slug)}
      onBlur={() => onHover?.(null)}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-strong">
        {campsite.coverPhoto ? (
          <img
            src={campsite.coverPhoto.url}
            alt={campsite.coverPhoto.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-faint">
            <MapPinIcon className="h-10 w-10" />
          </div>
        )}
        {fee && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
            {fee === 'Free' ? 'Free entrance' : `Entrance ${fee}`}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <Heading className="font-serif text-lg font-semibold leading-snug text-ink">{campsite.name}</Heading>
        <p className="flex items-center gap-1 text-sm text-ink-muted">
          <MapPinIcon className="h-4 w-4 shrink-0" />
          {placeName(campsite)}{' '}
          {drive && <span className="text-ink-faint">· {drive}</span>}
        </p>
        {campsite.rating.count > 0 && campsite.rating.average !== null ? (
          <p className="flex items-center gap-1.5 text-sm text-ink">
            <StarRating rating={campsite.rating.average} />{' '}
            <span className="font-semibold">{campsite.rating.average.toFixed(1)}</span>
            <span className="text-ink-muted">
              ({campsite.rating.count} {campsite.rating.count === 1 ? 'review' : 'reviews'})
            </span>
          </p>
        ) : (
          <p className="text-sm text-ink-muted">No reviews yet</p>
        )}
        {highlights.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Highlights">
            {highlights.map((highlight) => (
              <li key={highlight} className="rounded-full bg-brand-cream/60 px-2.5 py-0.5 text-xs font-medium text-brand-forest-dark">
                {highlight}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}
