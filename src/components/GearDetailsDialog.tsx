import { useEffect, useState } from 'react';
import type { BookableAddOn, BookableGearKind } from '../types/gearbnb';
import { formatCurrency } from '../utils/format';
import { sizeCapacityToShow } from '../utils/gearVariants';
import { splitBestForLine } from '../utils/bestForLine';
import { ID_VERIFICATION_FAQ, type FaqEntry } from '../utils/productFaq';
import FormattedDescription from './FormattedDescription';
import { GearPlaceholderIcon } from './icons';
import ImageLightbox, { type LightboxImage } from './ImageLightbox';
import ProductFaqSection from './ProductFaqSection';
import { AddOnRow, QuantityStepper } from '../pages/PathBCatalog';

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

/**
 * This kind's own FAQ: a capacity question built from its real Size/Capacity (never invented), the
 * verification question shared with every product (see ID_VERIFICATION_FAQ), and a deposit
 * question — kept generic here since a Build Your Own gear kind carries no deposit figure of its
 * own (unlike a package's real, known depositAmount — see buildPackageFaqEntries). Deliberately
 * does NOT restate what "Included Free" already shows visibly just below — an FAQ entry earns its
 * place by adding something the rest of the popup doesn't already say.
 */
function buildFaqEntries(kind: BookableGearKind): FaqEntry[] {
  const entries: FaqEntry[] = [];
  const capacity = sizeCapacityToShow(kind);
  if (capacity) {
    entries.push({
      question: `How many people does the ${kind.name} fit?`,
      answer: `The ${kind.name} comfortably fits ${capacity}.`,
    });
  }
  entries.push(ID_VERIFICATION_FAQ);
  entries.push({
    question: 'When do I pay the security deposit?',
    answer:
      'The refundable security deposit is due once your booking is confirmed, separate from the rental fee itself — the exact split is shown at checkout before you pay anything.',
  });
  return entries;
}

interface GearDetailsDialogProps {
  kind: BookableGearKind;
  quantity: number;
  onQuantityChange: (next: number) => void;
  onClose: () => void;
  /** Present only when the caller (GearCard) wants this kind's own "Optional Add-ons" — e.g. the
   *  Vidalido tent's "Extra Canopy Poles" — shown inside the popup too, not only on the card.
   *  Omitted entirely by callers that don't manage add-ons for this kind (PackageAddOnCard's own
   *  "View Details" use), in which case the section simply doesn't render. */
  addOnsSection?: {
    addOnQuantities: Map<string, number>;
    getPrice: (addOn: BookableAddOn) => number | null;
    hasDuration: boolean;
    showUpsell: boolean;
    showExtraDayRate: boolean;
    onAddOnQuantityChange: (addOn: BookableAddOn, next: number) => void;
  };
  /** Present only when this kind is being shown as one of a PACKAGE's own "What's Included" items
   *  (see PackageDetailsDialog) — the item isn't being rented separately here, it's already part
   *  of the package, so price/availability/"Add to cart"/Optional Add-ons are all hidden (showing a
   *  BYO or add-on price here would be actively wrong — that's not what the customer is paying).
   *  Gallery, category, name, "Best for", description and the FAQ still show, unchanged. The bottom
   *  full-width button becomes "← Back to Package" (calls `onBack`) instead of "Close" — the small
   *  ✕ in the corner still fully closes everything via the ordinary `onClose`. */
  viewOnly?: { onBack: () => void };
}

/**
 * "View Details" popup for a single Build Your Own gear kind — full photo gallery, price,
 * availability, size/capacity, the RMS's own description (when staff have written one), and a
 * product FAQ. A popup, not a separate page: it has no URL of its own, so nothing inside it
 * (including the FAQPage JSON-LD below) is something Google can credit to a specific address — see
 * this feature's own design discussion for what a real per-product URL would additionally buy.
 */
export default function GearDetailsDialog({ kind, quantity, onQuantityChange, onClose, addOnsSection, viewOnly }: GearDetailsDialogProps) {
  const gallery: LightboxImage[] =
    kind.images && kind.images.length > 0
      ? kind.images.map((src) => ({ src, alt: kind.name }))
      : kind.imageUrl
        ? [{ src: kind.imageUrl, alt: kind.name }]
        : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  // Popup only, never the compact card: Size/Capacity is dropped from the header here because the
  // formatted description below (when there is one) already shows it as its own bolded "Capacity:"
  // line — see FormattedDescription. "Best for ..." (same convention as packages — see
  // splitBestForLine's own doc comment) takes that spot instead. `rest` (not the raw description)
  // is what actually renders below, so that first line is never shown twice.
  const { bestFor, rest: descriptionBody } = splitBestForLine(kind.description ?? '');
  const faqEntries = buildFaqEntries(kind);
  const isSelected = quantity > 0;

  // Esc closes the dialog, same convention as ImageLightbox's own.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

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
        aria-label={kind.name}
      >
        <div className="relative">
          {/* No forced aspect ratio and no object-cover: the photo shows at its own proportions,
              never cropped, up to a height cap so a very tall photo still fits the popup. The
              placeholder (no real photo yet) gets its own modest fixed height instead — there's
              nothing to size it against. */}
          <div className="relative flex max-h-[65vh] w-full items-center justify-center overflow-hidden bg-surface-strong">
            {gallery.length === 0 || imageFailed ? (
              <div className="flex h-56 w-full items-center justify-center">
                <GearPlaceholderIcon className="h-14 w-14 text-ink-faint" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label={`View larger image of ${kind.name}`}
                className="w-full"
              >
                <img
                  src={gallery[activeIndex].src}
                  alt={kind.name}
                  onError={() => setImageFailed(true)}
                  className="mx-auto max-h-[65vh] w-full object-contain"
                />
              </button>
            )}
            {!kind.canSelect && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                <span className="rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white">Out of Stock</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
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
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                  activeIndex === index ? 'border-brand-forest' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={photo.src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{kind.category}</p>
            <h2 className="font-serif text-xl font-bold text-ink sm:text-2xl">{kind.name}</h2>
            {bestFor && <p className="-mt-1 text-sm font-semibold text-accent">Best for {bestFor}</p>}
          </div>

          {descriptionBody && <FormattedDescription text={descriptionBody} />}

          {kind.freeAccessories.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Included Free</p>
              <ul className="flex flex-col gap-1 text-sm text-ink">
                {kind.freeAccessories.map((accessory) => (
                  <li key={accessory.name}>🎁 {accessory.name}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Hidden entirely in viewOnly mode (this kind is a package's own included item, not
              being rented separately) — see this component's own doc comment on `viewOnly`. */}
          {!viewOnly && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted p-3">
              <div>
                <p className="text-lg font-bold text-accent">
                  {formatCurrency(kind.pricing['48h'])}
                  <span className="text-sm font-normal text-ink-muted"> / 48h</span>
                </p>
                <p className="text-xs text-ink-muted">
                  {formatCurrency(kind.pricing['72h'])} / 72h · +{formatCurrency(kind.extraPerDayPrice)} per extra day
                </p>
              </div>
              {kind.canSelect ? (
                <span className="text-xs text-ink-faint">Avail: {kind.availableCount}</span>
              ) : (
                <span className="text-xs font-medium text-ink-faint">Unavailable</span>
              )}
            </div>
          )}

          {!viewOnly && kind.canSelect && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-ink">{isSelected ? 'In your cart' : 'Add to cart'}</span>
              <QuantityStepper value={quantity} max={kind.availableCount} ariaLabel={kind.name} onChange={onQuantityChange} />
            </div>
          )}

          {/* Same gate the card itself uses: an add-on is attached to a SPECIFIC selected kind, so
              it only makes sense to offer once this kind is actually in the cart — never in
              viewOnly mode either way, since there's no cart selection to attach an add-on to. */}
          {!viewOnly && isSelected && addOnsSection && kind.compatibleAddOns.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Optional Add-ons</p>
              {kind.compatibleAddOns.map((addOn) => {
                const key = `${addOn.category}|${addOn.brand}|${addOn.model ?? ''}`;
                return (
                  <AddOnRow
                    key={key}
                    addOn={addOn}
                    quantity={addOnsSection.addOnQuantities.get(key) ?? 0}
                    hasDuration={addOnsSection.hasDuration}
                    price={addOnsSection.getPrice(addOn)}
                    showUpsell={addOnsSection.showUpsell}
                    showExtraDayRate={addOnsSection.showExtraDayRate}
                    onChange={(next) => addOnsSection.onAddOnQuantityChange(addOn, next)}
                  />
                );
              })}
            </div>
          )}

          <ProductFaqSection entries={faqEntries} />

          {/* A second, unmissable exit — the ✕ over the photo is easy to miss on mobile, where this
              popup is a near-full-height sheet: after scrolling down to read the FAQ, this is the
              closest way out without scrolling back up to hunt for it. In viewOnly mode this same
              button returns to the package instead — the ✕ above still fully closes everything. */}
          <button
            type="button"
            onClick={viewOnly ? viewOnly.onBack : onClose}
            className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-strong"
          >
            {viewOnly ? '← Back to Package' : 'Close'}
          </button>
        </div>
      </div>

      {lightboxOpen && gallery.length > 0 && (
        <ImageLightbox
          images={gallery}
          index={activeIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setActiveIndex}
        />
      )}
    </div>
  );
}
