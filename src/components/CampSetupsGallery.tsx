import { useRef, useState } from 'react';
import { type CampSetupPhoto } from '../config/campSetups';
import ImageLightbox from './ImageLightbox';
import { GearPlaceholderIcon } from './icons';

function ChevronArrowIcon({ direction, className }: { direction: 'left' | 'right'; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

function EmptyGalleryPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface-muted p-10 text-center">
      <GearPlaceholderIcon className="h-10 w-10 text-ink-faint" />
      <p className="text-sm font-medium text-ink">Photos coming soon</p>
      <p className="max-w-sm text-sm text-ink-muted">
        We&rsquo;re putting together real camp setup photos from our renters — check back soon!
      </p>
    </div>
  );
}

/**
 * "Camping Inspiration Gallery" — a swipeable photo carousel, not a catalog grid. The photo itself
 * is the entire tile (no title/description caption underneath it, per the client's request that
 * this feel like inspiration browsing rather than a list of named setups); each photo's title
 * still exists for accessibility (`aria-label` on its slide) and stays visible inside the lightbox,
 * which is the one place a caption still earns its keep.
 *
 * Same hand-rolled CSS scroll-snap + `scrollBy`/`scrollTo` approach as the homepage's own
 * `BundleSlider` (see LandingPage.tsx) rather than pulling in a carousel dependency — native
 * touch/drag swiping on mobile for free, plus arrow buttons and dot pagination as the "clean
 * carousel navigation" for desktop/tablet.
 */
export default function CampSetupsGallery({ photos }: { photos: CampSetupPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  /** One slide's full stride (its own width plus the gap after it) — every slide in this track is
   * the same width, so this is a reliable unit for both scrollBy and index math. */
  function getSlideStride(track: HTMLDivElement): number {
    const first = track.firstElementChild as HTMLElement | null;
    if (!first) return track.clientWidth;
    const second = track.children[1] as HTMLElement | undefined;
    const gap = second ? second.offsetLeft - first.offsetLeft - first.offsetWidth : 16;
    return first.offsetWidth + gap;
  }

  function scrollByDirection(direction: 'left' | 'right') {
    const track = trackRef.current;
    if (!track) return;
    const stride = getSlideStride(track);
    track.scrollBy({ left: direction === 'left' ? -stride : stride, behavior: 'smooth' });
  }

  function scrollToIndex(index: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: getSlideStride(track) * index, behavior: 'smooth' });
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    // The last slide can become fully visible before scrollLeft reaches a full extra stride (the
    // track simply runs out of room to scroll further), so scrollLeft/stride alone can
    // under-report the index once you're at the end — checking against the actual scroll max
    // first avoids the last dot/arrow state ever looking stuck one slide behind.
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    if (track.scrollLeft >= maxScrollLeft - 2) {
      setActiveIndex(photos.length - 1);
      return;
    }
    const stride = getSlideStride(track);
    const index = stride > 0 ? Math.round(track.scrollLeft / stride) : 0;
    setActiveIndex(Math.max(0, Math.min(photos.length - 1, index)));
  }

  if (photos.length === 0) return <EmptyGalleryPlaceholder />;

  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= photos.length - 1;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="relative">
          {/* -mx-5/px-5 (sm: -mx-6/px-6) lets the track's own horizontal scroll padding line up
              with the section's outer padding, matching BundleSlider's identical trick, so the
              first/last photo's edge sits flush with the rest of the page content. */}
          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-2 sm:-mx-6 sm:gap-5 sm:px-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
          >
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setOpenIndex(index)}
                aria-label={`View larger photo: ${photo.title}`}
                className="group aspect-[4/3] w-[82%] shrink-0 snap-start overflow-hidden rounded-2xl shadow-sm sm:w-[44%] lg:w-[30%]"
              >
                {/* Subtle hover/tap zoom — overflow-hidden on the button above clips the scaled
                    image to the tile's own rounded corners rather than spilling over them. */}
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 group-active:scale-105"
                />
              </button>
            ))}
          </div>

          {/* Arrow controls — hidden on touch-first small screens where dragging the track
           * directly is the natural interaction; shown from sm: up as the "clean carousel
           * navigation" for desktop/tablet. Disabled (not hidden) at either end, so their
           * position never shifts as you page through. */}
          <button
            type="button"
            onClick={() => scrollByDirection('left')}
            disabled={atStart}
            aria-label="Previous photo"
            className="absolute -left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-md transition-all hover:bg-surface-strong disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <ChevronArrowIcon direction="left" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByDirection('right')}
            disabled={atEnd}
            aria-label="Next photo"
            className="absolute -right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-md transition-all hover:bg-surface-strong disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <ChevronArrowIcon direction="right" className="h-5 w-5" />
          </button>
        </div>

        {/* Dot pagination — shows how many photos there are and which one is in view; also a
         * direct jump-to-slide control, not purely decorative. */}
        {photos.length > 1 && (
          <div className="flex items-center justify-center gap-2">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => scrollToIndex(index)}
                aria-label={`Go to photo: ${photo.title}`}
                aria-current={index === activeIndex}
                className={`h-2 rounded-full transition-all ${
                  index === activeIndex ? 'w-6 bg-brand-forest' : 'w-2 bg-line hover:bg-ink-faint'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {openIndex !== null && (
        <ImageLightbox images={photos} index={openIndex} onClose={() => setOpenIndex(null)} onNavigate={setOpenIndex} />
      )}
    </>
  );
}
