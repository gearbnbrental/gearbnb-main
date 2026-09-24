import { useRef, type TouchEvent } from 'react';

const SWIPE_MIN_PX = 40;

/** Touch handlers that call onPrev/onNext on a mostly-horizontal swipe. */
export function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (event: TouchEvent) => {
      const touch = event.touches[0];
      start.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd: (event: TouchEvent) => {
      const origin = start.current;
      start.current = null;
      if (!origin) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) onNext();
      else onPrev();
    },
  };
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

interface GalleryNavProps {
  count: number;
  index: number;
  onChange: (next: number) => void;
}

/**
 * Always-visible cues that a photo has more photos: prev/next arrows, a "1 / N" counter and dots.
 * Renders nothing for a single photo. Place inside a `relative` photo container; the container
 * should also use useSwipe for touch swiping.
 */
export default function GalleryNav({ count, index, onChange }: GalleryNavProps) {
  if (count < 2) return null;
  const go = (next: number) => onChange((next + count) % count);
  const arrowClass =
    'absolute top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white shadow transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';
  return (
    <>
      <button type="button" onClick={() => go(index - 1)} aria-label="Previous photo" className={`${arrowClass} left-2`}>
        <Chevron direction="left" />
      </button>
      <button type="button" onClick={() => go(index + 1)} aria-label="Next photo" className={`${arrowClass} right-2`}>
        <Chevron direction="right" />
      </button>
      <span className="absolute left-3 top-3 z-30 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
        {index + 1} / {count}
      </span>
      <div className="pointer-events-none absolute bottom-2 left-0 right-0 z-30 flex justify-center gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`} />
        ))}
      </div>
    </>
  );
}
