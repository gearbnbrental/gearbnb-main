/**
 * A campsite's photos, Airbnb style: on wide screens a mosaic (one big photo and four small ones)
 * with "Show all photos"; on phones a full-width swipe slider with a "1 / 12" counter. "Show all
 * photos" opens the photo tour, a full-screen gallery split into "From the campsite" and "From
 * campers" (photos campers attached to their reviews); tapping any photo opens the slider with
 * arrows, swiping, a thumbnail strip and who shared it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSwipe } from '../GalleryNav';
import type { Campsite } from '../../types/campsite';
import { MapPinIcon } from '../icons';

export interface GalleryPhoto {
  url: string;
  alt: string;
  source: 'campsite' | 'camper';
  /** "Shared by Maria S., camper" or "Photo: Sample Riverside Campsite". */
  caption: string | null;
}

/** The campsite's own photos first, then every photo campers attached to their reviews. */
function galleryPhotos(campsite: Campsite): GalleryPhoto[] {
  return [
    ...campsite.photos.map((photo) => ({
      url: photo.url,
      alt: photo.alt || campsite.name,
      source: 'campsite' as const,
      caption: photo.credit ? `Photo: ${photo.credit}` : null,
    })),
    ...campsite.reviews.flatMap((review) =>
      review.photos.map((photo) => ({
        url: photo.url,
        alt: photo.alt || `Photo of ${campsite.name} from ${review.displayName}`,
        source: 'camper' as const,
        caption: `Shared by ${review.displayName}${review.isRenter ? ', GearBnB renter' : ', camper'}${photo.alt ? ` · ${photo.alt}` : ''}`,
      })),
    ),
  ];
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      {[1, 6.5, 12].flatMap((y) => [1, 6.5, 12].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="3" height="3" rx="0.5" />))}
    </svg>
  );
}

/** Locks page scroll while a full-screen layer is open, and closes it on Escape. */
function useOverlay(open: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onEscape();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onEscape]);
}

/** The full-screen slider: one photo at a time, arrows, swipe, thumbnails and the caption. */
export function PhotoSlider({ photos, index, onIndex, onClose }: { photos: GalleryPhoto[]; index: number; onIndex: (next: number) => void; onClose: () => void }) {
  const count = photos.length;
  const go = useCallback((next: number) => onIndex((next + count) % count), [count, onIndex]);
  const swipe = useSwipe(
    () => go(index - 1),
    () => go(index + 1),
  );
  const stripRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useOverlay(true, onClose);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') go(index - 1);
      if (event.key === 'ArrowRight') go(index + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, index]);
  useEffect(() => {
    stripRef.current?.querySelector(`[data-thumb="${index}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [index]);

  const photo = photos[index];
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <button ref={closeRef} type="button" onClick={onClose} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold hover:bg-white/10">
          <Chevron direction="left" /> Close
        </button>
        <span className="text-sm text-white/80" aria-live="polite">
          {index + 1} / {count}
        </span>
        <span className="w-20" />
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16" {...swipe}>
        <img key={photo.url} src={photo.url} alt={photo.alt} className="max-h-full max-w-full rounded-lg object-contain" />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/40 hover:bg-white/15 sm:flex"
            >
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/40 hover:bg-white/15 sm:flex"
            >
              <Chevron direction="right" />
            </button>
          </>
        )}
      </div>
      <p className="min-h-6 px-4 pt-3 text-center text-sm text-white/80">
        <span className="mr-2 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
          {photo.source === 'camper' ? 'From a camper' : 'From the campsite'}
        </span>
        {photo.caption}
      </p>
      {count > 1 && (
        <div ref={stripRef} className="flex gap-2 overflow-x-auto px-4 py-3 sm:justify-center">
          {photos.map((thumb, thumbIndex) => (
            <button
              key={`${thumb.url}-${thumbIndex}`}
              type="button"
              data-thumb={thumbIndex}
              onClick={() => onIndex(thumbIndex)}
              aria-label={`Photo ${thumbIndex + 1}`}
              aria-current={thumbIndex === index}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded-md transition-opacity ${thumbIndex === index ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-90'}`}
            >
              <img src={thumb.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

type TourTab = 'all' | 'campsite' | 'camper';

/** "Show all photos": every photo in a scrolling gallery, with tabs by who shared them. */
function PhotoTour({
  name,
  photos,
  sliderOpen,
  onOpenPhoto,
  onClose,
}: {
  name: string;
  photos: GalleryPhoto[];
  /** While the slider is open on top, Escape closes only the slider. */
  sliderOpen: boolean;
  onOpenPhoto: (index: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TourTab>('all');
  const closeRef = useRef<HTMLButtonElement>(null);
  const onEscape = useCallback(() => {
    if (!sliderOpen) onClose();
  }, [sliderOpen, onClose]);
  useOverlay(true, onEscape);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const counts = { all: photos.length, campsite: photos.filter((photo) => photo.source === 'campsite').length, camper: photos.filter((photo) => photo.source === 'camper').length };
  const shown = photos.map((photo, index) => ({ photo, index })).filter(({ photo }) => tab === 'all' || photo.source === tab);
  const tabs: { id: TourTab; label: string }[] = [
    { id: 'all', label: 'All photos' },
    { id: 'campsite', label: 'From the campsite' },
    { id: 'camper', label: 'From campers' },
  ];

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Photos of ${name}`} className="fixed inset-0 z-[60] overflow-y-auto bg-page">
      <div className="sticky top-0 z-10 border-b border-line bg-page/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close photos" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-strong">
            <Chevron direction="left" />
          </button>
          <div role="tablist" aria-label="Show photos from" className="flex gap-1 overflow-x-auto">
            {tabs.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={tab === option.id}
                disabled={counts[option.id] === 0}
                onClick={() => setTab(option.id)}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                  tab === option.id ? 'bg-ink text-white' : 'text-ink hover:bg-surface-strong'
                }`}
              >
                {option.label} <span className={tab === option.id ? 'text-white/70' : 'text-ink-muted'}>{counts[option.id]}</span>
              </button>
            ))}
          </div>
          <span className="hidden w-10 sm:block" />
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <h2 className="mb-4 font-serif text-2xl font-semibold text-ink">{name}</h2>
        {/* Airbnb's rhythm: a full-width photo, then two side by side, repeated. */}
        <ul className="grid grid-cols-2 gap-2">
          {shown.map(({ photo, index }, position) => (
            <li key={`${photo.url}-${index}`} className={position % 3 === 0 ? 'col-span-2' : ''}>
              <button type="button" onClick={() => onOpenPhoto(index)} className="group relative block w-full overflow-hidden rounded-lg bg-surface-strong" aria-label={`Open photo ${index + 1}: ${photo.alt}`}>
                <img src={photo.url} alt={photo.alt} loading="lazy" className={`w-full object-cover transition-opacity group-hover:opacity-90 ${position % 3 === 0 ? 'aspect-[3/2]' : 'aspect-square'}`} />
                {photo.source === 'camper' && (
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-ink">From a camper</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export default function CampsiteGallery({ campsite }: { campsite: Campsite }) {
  const photos = useMemo(() => galleryPhotos(campsite), [campsite]);
  const [tourOpen, setTourOpen] = useState(false);
  const [slide, setSlide] = useState<number | null>(null);
  const [mobileIndex, setMobileIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const closeTour = useCallback(() => setTourOpen(false), []);
  const closeSlide = useCallback(() => setSlide(null), []);
  const count = photos.length;

  if (count === 0) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl bg-surface-strong text-ink-faint">
        <MapPinIcon className="h-12 w-12" />
      </div>
    );
  }

  const showAll = (
    <button
      type="button"
      onClick={() => setTourOpen(true)}
      className="flex items-center gap-2 rounded-lg border border-ink bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-surface-strong"
    >
      <GridIcon /> Show all photos
    </button>
  );
  const tile = (index: number, className: string) =>
    photos[index] ? (
      <button key={index} type="button" onClick={() => setSlide(index)} className={`group relative overflow-hidden bg-surface-strong ${className}`} aria-label={`Open photo ${index + 1}`}>
        <img src={photos[index].url} alt={photos[index].alt} loading={index === 0 ? 'eager' : 'lazy'} className="h-full w-full object-cover transition-[filter] duration-200 group-hover:brightness-90" />
      </button>
    ) : null;

  return (
    <>
      {/* Phones: a full-width slider. */}
      <div className="relative -mx-5 sm:hidden">
        <div
          ref={trackRef}
          onScroll={(event) => {
            const track = event.currentTarget;
            setMobileIndex(Math.round(track.scrollLeft / track.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, index) => (
            <button key={`${photo.url}-${index}`} type="button" onClick={() => setSlide(index)} className="aspect-[4/3] w-full shrink-0 snap-center" aria-label={`Open photo ${index + 1}`}>
              <img src={photo.url} alt={photo.alt} loading={index === 0 ? 'eager' : 'lazy'} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-xs font-semibold text-white">
          {mobileIndex + 1} / {count}
        </span>
        <div className="absolute bottom-3 left-3">{showAll}</div>
      </div>

      {/* Tablet and up: the mosaic. */}
      <div className="relative hidden overflow-hidden rounded-2xl sm:block">
        {count === 1 ? (
          <div className="aspect-[2/1]">{tile(0, 'h-full w-full')}</div>
        ) : count < 5 ? (
          <div className="grid aspect-[2/1] grid-cols-3 grid-rows-2 gap-2">
            {tile(0, 'col-span-2 row-span-2')}
            {tile(1, count === 2 ? 'row-span-2' : '')}
            {tile(2, '')}
          </div>
        ) : (
          <div className="grid aspect-[2/1] grid-cols-4 grid-rows-2 gap-2">
            {tile(0, 'col-span-2 row-span-2')}
            {tile(1, '')}
            {tile(2, '')}
            {tile(3, '')}
            {tile(4, '')}
          </div>
        )}
        <div className="absolute bottom-4 right-4">{showAll}</div>
      </div>

      {tourOpen && <PhotoTour name={campsite.name} photos={photos} sliderOpen={slide !== null} onOpenPhoto={setSlide} onClose={closeTour} />}
      {slide !== null && <PhotoSlider photos={photos} index={slide} onIndex={setSlide} onClose={closeSlide} />}
    </>
  );
}
