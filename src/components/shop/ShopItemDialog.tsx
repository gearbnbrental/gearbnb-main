import { useEffect, useState } from 'react';
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_E164, MESSENGER_URL } from '../../config/social';
import { useProductViewOpen } from '../../utils/productView';
import { brandAndModelLine, type ShopItem } from '../../utils/shop';
import GalleryNav, { useSwipe } from '../GalleryNav';
import { GearPlaceholderIcon } from '../icons';
import ImageLightbox, { type LightboxImage } from '../ImageLightbox';
import { ConditionBadge, ShopPrice } from './ShopItemCard';

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

/**
 * One shop item's details: photo gallery, every field the RMS sends, the description and the
 * price. Buying happens over Messenger for now ("Interested? Message us"); a later stage swaps that
 * for a real checkout. Same popup layout as the rental gear details (GearDetailsDialog).
 */
export default function ShopItemDialog({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  useProductViewOpen();
  const gallery: LightboxImage[] = item.images.map((src, index) => ({ src, alt: `${item.name}, photo ${index + 1}` }));
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const swipe = useSwipe(
    () => setActiveIndex((i) => (i - 1 + gallery.length) % gallery.length),
    () => setActiveIndex((i) => (i + 1) % gallery.length),
  );
  const active = gallery[activeIndex];
  const showPhoto = active && !failed.has(active.src);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !lightboxOpen) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, lightboxOpen]);

  const facts: [string, string | null][] = [
    ['Category', item.category],
    ['Brand', item.brand || null],
    ['Model', item.model],
    ['Color', item.color],
    ['Condition', item.condition || null],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-2xl bg-surface shadow-xl sm:max-w-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-item-title"
      >
        <div className="relative">
          <div {...swipe} className="relative flex max-h-[65vh] w-full items-center justify-center overflow-hidden bg-surface-strong">
            {showPhoto ? (
              <button type="button" onClick={() => setLightboxOpen(true)} aria-label={`View larger photo of ${item.name}`} className="w-full">
                <img
                  src={active.src}
                  alt={active.alt}
                  onError={() => setFailed((prev) => new Set(prev).add(active.src))}
                  className="mx-auto max-h-[65vh] w-full object-contain"
                />
              </button>
            ) : (
              <div className="flex h-56 w-full flex-col items-center justify-center gap-2 text-ink-faint">
                <GearPlaceholderIcon className="h-14 w-14" />
                <span className="text-xs font-medium">{gallery.length ? 'This photo could not load' : 'Photo coming soon'}</span>
              </div>
            )}
            <GalleryNav count={gallery.length} index={activeIndex} onChange={setActiveIndex} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {gallery.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 pt-3">
            {gallery.map((photo, index) => (
              <button
                key={photo.src}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Photo ${index + 1} of ${gallery.length}`}
                aria-current={activeIndex === index}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-surface-strong transition-colors ${
                  activeIndex === index ? 'border-brand-forest' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                {!failed.has(photo.src) && <img src={photo.src} alt="" className="h-full w-full object-cover" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{item.category}</p>
            <h2 id="shop-item-title" className="font-serif text-xl font-bold text-ink sm:text-2xl">
              {item.name}
            </h2>
            {brandAndModelLine(item) && <p className="-mt-1 text-sm text-ink-muted">{brandAndModelLine(item)}</p>}
            <ConditionBadge condition={item.condition} className="mt-1" />
          </div>

          <div className="rounded-xl bg-surface-muted p-3">
            <ShopPrice item={item} size="large" />
            <p className="text-xs text-ink-muted">The price is for this one piece.</p>
          </div>

          {item.description && <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{item.description}</p>}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {facts
              .filter((fact): fact is [string, string] => Boolean(fact[1]))
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="font-medium text-ink">{value}</dd>
                </div>
              ))}
          </dl>

          <div className="flex flex-col gap-2 rounded-xl border border-brand-forest/20 bg-brand-forest/5 p-4">
            <p className="font-semibold text-ink">Interested? Message us</p>
            <p className="text-sm text-ink-muted">
              Send us the item name, <span className="font-medium text-ink">{item.name}</span>, and we&rsquo;ll confirm it&rsquo;s still
              available and how to buy it.
            </p>
            <a
              href={MESSENGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center justify-center rounded-lg bg-brand-forest px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-forest-dark"
            >
              Message Us on Messenger
            </a>
            <p className="text-center text-xs text-ink-muted">
              Or call us at{' '}
              <a href={`tel:${CONTACT_PHONE_E164}`} className="font-medium text-accent underline underline-offset-2">
                {CONTACT_PHONE_DISPLAY}
              </a>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-strong"
          >
            Close
          </button>
        </div>
      </div>

      {lightboxOpen && gallery.length > 0 && (
        <ImageLightbox images={gallery} index={activeIndex} onClose={() => setLightboxOpen(false)} onNavigate={setActiveIndex} />
      )}
    </div>
  );
}
