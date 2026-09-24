import { useEffect } from 'react';
import { useSwipe } from './GalleryNav';

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronArrowIcon({ direction, className }: { direction: 'left' | 'right'; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

export interface LightboxImage {
  src: string;
  alt: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  /** Only ever called when `images.length > 1` — the nav controls that call this are themselves
   *  hidden otherwise, so a single-image caller can safely pass a no-op. */
  onNavigate: (nextIndex: number) => void;
}

/**
 * The site's one shared full-screen image viewer — originally built for CampSetupsGallery's own
 * multi-photo carousel, generalized here so every other "click a product photo to see it larger"
 * spot (package cards, Build Your Own gear cards, the gear detail modal, ...) reuses the exact
 * same component instead of each growing its own. Deliberately the image and nothing else: no
 * caption, no CTA, no gear list — per the original "PHOTO → CLICK → ZOOM" request this was built
 * for, which applies just as well to any other product photo a renter wants to inspect closely.
 *
 * Escape and a click on the dimmed backdrop both close it (two independent, standard ways to
 * dismiss a modal); Left/Right arrow keys step between images when there's more than one, and the
 * on-screen prev/next buttons + "N / total" counter only render in that case — a single-image
 * caller gets a plain, chrome-free viewer with just the close button. Focus-trapping is
 * intentionally not implemented — this is a photo viewer with a handful of controls, not a form,
 * so the added complexity of a full trap isn't earning its keep here.
 */
export default function ImageLightbox({ images, index, onClose, onNavigate }: ImageLightboxProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (images.length > 1 && event.key === 'ArrowRight') onNavigate((index + 1) % images.length);
      if (images.length > 1 && event.key === 'ArrowLeft') onNavigate((index - 1 + images.length) % images.length);
    }
    document.addEventListener('keydown', handleKeyDown);
    // Locks background scroll while the lightbox is open — a full-screen overlay with the page
    // still scrolling behind it reads as broken, especially on mobile.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, images.length, onClose, onNavigate]);

  const swipe = useSwipe(
    () => images.length > 1 && onNavigate((index - 1 + images.length) % images.length),
    () => images.length > 1 && onNavigate((index + 1) % images.length),
  );

  const image = images[index];
  if (!image) return null;

  const controlButtonClass =
    'flex items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.alt}
      onClick={onClose}
      {...swipe}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-8"
    >
      <button type="button" onClick={onClose} aria-label="Close" className={`absolute right-4 top-4 h-10 w-10 ${controlButtonClass}`}>
        <XMarkIcon className="h-5 w-5" />
      </button>

      {/* 1-based "N / total" — a small, standard orientation cue so a customer flipping through
          knows how many photos there are and where they are in the set. */}
      {images.length > 1 && (
        <span className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          {index + 1} / {images.length}
        </span>
      )}

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((index - 1 + images.length) % images.length);
            }}
            aria-label="Previous photo"
            className={`absolute left-2 top-1/2 h-11 w-11 -translate-y-1/2 sm:left-4 ${controlButtonClass}`}
          >
            <ChevronArrowIcon direction="left" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((index + 1) % images.length);
            }}
            aria-label="Next photo"
            className={`absolute right-2 top-1/2 h-11 w-11 -translate-y-1/2 sm:right-4 ${controlButtonClass}`}
          >
            <ChevronArrowIcon direction="right" className="h-5 w-5" />
          </button>
        </>
      )}

      {/* stopPropagation keeps a click on the image itself from reaching the backdrop's onClose. */}
      <img
        key={image.src}
        src={image.src}
        alt={image.alt}
        onClick={(e) => e.stopPropagation()}
        className="camp-zoom-in max-h-full max-w-full rounded-xl object-contain shadow-2xl"
      />
    </div>
  );
}
