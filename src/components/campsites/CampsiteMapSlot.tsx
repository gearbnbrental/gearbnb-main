import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { CampsiteMapProps } from './CampsiteMap';

const CampsiteMap = lazy(() => import('./CampsiteMap'));

/**
 * Where a map goes on a page. The map library loads only once this spot scrolls near the screen,
 * and never during the build (the pre-built HTML gets the placeholder).
 */
export default function CampsiteMapSlot(props: CampsiteMapProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const className = props.className ?? 'h-96';

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  const placeholder = <div aria-hidden="true" className="h-full w-full animate-pulse bg-surface-strong" />;
  return (
    <div ref={slotRef} className={`overflow-hidden ${className}`}>
      {visible ? (
        <Suspense fallback={placeholder}>
          <CampsiteMap {...props} className="h-full" />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}
