import { useId, type KeyboardEvent } from 'react';

const STAR_PATH =
  'M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.26 3.88a1 1 0 0 0 .95.69h4.08c.97 0 1.37 1.24.59 1.81l-3.3 2.4a1 1 0 0 0-.37 1.11l1.27 3.88c.3.92-.76 1.69-1.54 1.12l-3.3-2.4a1 1 0 0 0-1.18 0l-3.3 2.4c-.78.57-1.83-.2-1.54-1.12l1.27-3.88a1 1 0 0 0-.36-1.12l-3.3-2.4c-.79-.56-.38-1.8.58-1.8h4.08a1 1 0 0 0 .95-.7l1.26-3.87Z';

function Star({ fill, className }: { fill: number; className: string }) {
  const clipId = useId();
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className}>
      <path d={STAR_PATH} className="fill-[#d1d5db]" />
      {fill > 0 && (
        <>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={20 * fill} height="20" />
          </clipPath>
          <path d={STAR_PATH} fill="#f5b400" clipPath={`url(#${clipId})`} />
        </>
      )}
    </svg>
  );
}

/** Five stars filled to `rating` (to the nearest half), with the rating as text for screen readers. */
export function StarRating({ rating, className = 'h-4 w-4' }: { rating: number; className?: string }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="flex items-center gap-0.5">
      <span className="sr-only">Rated {rating} out of 5. </span>
      {Array.from({ length: 5 }, (_, star) => (
        <Star key={star} fill={Math.max(0, Math.min(1, rounded - star))} className={className} />
      ))}
    </span>
  );
}

/**
 * Picking a rating: a radio group of five stars. Arrow keys move between them (as any radio group),
 * and each star says its number aloud.
 */
export function StarRatingInput({
  value,
  onChange,
  labelledBy,
  invalid,
  describedBy,
}: {
  value: number;
  onChange: (rating: number) => void;
  labelledBy: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  function handleKeyDown(event: KeyboardEvent) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = Math.min(5, Math.max(1, (value || 0) + step));
    onChange(next);
    (event.currentTarget.querySelector(`[data-star="${next}"]`) as HTMLElement | null)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-1"
    >
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1;
        const checked = value === star;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            data-star={star}
            aria-checked={checked}
            aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
            tabIndex={checked || (!value && star === 1) ? 0 : -1}
            onClick={() => onChange(star)}
            className="rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest"
          >
            <Star fill={star <= value ? 1 : 0} className="h-8 w-8" />
          </button>
        );
      })}
    </div>
  );
}
