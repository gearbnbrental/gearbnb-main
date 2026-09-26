import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '../context/useCatalog';
import type { BookableGearKind, PackageComponent } from '../types/gearbnb';
import { formatCurrency } from '../utils/format';
import { splitBestForLine } from '../utils/bestForLine';
import { classifyComponent, matchComponentToGearKind } from '../utils/packageComponents';
import { buildFaqLinkTargets } from '../utils/faqLinks';
import { packageSpecificFaq } from '../utils/packageFaq';
import { ID_VERIFICATION_FAQ, type FaqEntry } from '../utils/productFaq';
import GalleryNav, { useSwipe } from './GalleryNav';
import GearDetailsDialog from './GearDetailsDialog';
import { GearPlaceholderIcon } from './icons';
import ImageLightbox, { type LightboxImage } from './ImageLightbox';
import PackageContents from './PackageContents';
import ProductFaqSection from './ProductFaqSection';
import { cleanGearName } from '../utils/gearName';
import { withDefaultVariant } from '../utils/gearVariants';

function componentLabel(component: PackageComponent): string {
  return cleanGearName(component.name ?? ([component.brand, component.model].filter(Boolean).join(' ') || component.category));
}

// Tent first, then bed; everything else keeps the RMS's own order (Array.sort is stable).
function categoryRank(component: PackageComponent): number {
  const category = component.category.toLowerCase();
  return category === 'tent' ? 0 : category === 'bed' ? 1 : 2;
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

/**
 * This package's own FAQ: the verification question shared with every product (see
 * ID_VERIFICATION_FAQ), and a deposit question with this package's REAL amount — unlike gear's own
 * dialog (BookableGearKind carries no deposit figure), a package always has one. Deliberately no
 * "what's included" or "who is this for" question: PackageContents and the Best For line just
 * above already answer those visibly, and an FAQ entry earns its place by adding something new.
 */
function buildFaqEntries(packageName: string, depositAmount: number): FaqEntry[] {
  return [
    ...packageSpecificFaq(packageName),
    ID_VERIFICATION_FAQ,
    {
      question: 'When do I pay the security deposit?',
      answer: `The refundable ${formatCurrency(depositAmount)} security deposit is due once your booking is confirmed, separate from the rental fee itself. If you add extras on top of the package, the deposit may vary depending on your add-ons. In most cases it stays the same unless the order is big.`,
    },
  ];
}

interface PackageDetailsDialogProps {
  /** The package as it should actually be shown/booked — the caller (PackageCard) has already
   *  resolved this to whichever edition/color is currently selected, exactly as it would add it to
   *  the cart. Never the raw multi-edition kit. */
  name: string;
  imageUrl: string;
  /** A real photo gallery for this package/edition, when the RMS has one — see PackageKit.images'
   *  own doc comment. Undefined/empty falls back to the single `imageUrl`, unchanged from before
   *  this existed. */
  images?: string[];
  description: string;
  includedItems: string[];
  /** This package's own real component list (see PackageComponent's own doc comment) — when
   *  present, replaces the free-text-guessed "What's Included" list with the RMS's real one, and
   *  lets a matched item link to its own product details (see matchComponentToGearKind).
   *  Undefined for a kit the RMS hasn't attached this to yet, in which case this falls back to the
   *  original free-text rendering, unchanged. */
  components?: PackageComponent[];
  paxRange: string;
  pricing: { '48h': number; '72h': number };
  depositAmount: number;
  isOutOfStock: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
  onClose: () => void;
}

/**
 * "View Details" popup for a package — mirrors GearDetailsDialog's layout so both products read as
 * one feature: a real photo gallery when the RMS has one for this package (falling back to the
 * single Supabase photo when it doesn't — most packages, until staff upload more), and a
 * "Best for ..." tagline pulled from the FIRST LINE of the package's own description when staff
 * have written one (see splitBestForLine's own doc comment for the exact convention). A popup, not
 * a separate page: same no-URL caveat on the FAQPage JSON-LD as GearDetailsDialog — see
 * ProductFaqSection.
 */
export default function PackageDetailsDialog({
  name,
  imageUrl,
  images,
  description,
  includedItems,
  components,
  paxRange,
  pricing,
  depositAmount,
  isOutOfStock,
  isSelected,
  onToggleSelected,
  onClose,
}: PackageDetailsDialogProps) {
  const { gearKinds } = useCatalog();
  const gallery: LightboxImage[] = [...(imageUrl ? [imageUrl] : []), ...(images ?? [])]
    .filter((src, index, all) => all.indexOf(src) === index)
    .map((src) => ({ src, alt: name }));
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const swipe = useSwipe(
    () => setActiveIndex((i) => (i - 1 + gallery.length) % gallery.length),
    () => setActiveIndex((i) => (i + 1) % gallery.length),
  );
  // Drilled into one included item's own details — see the early return just below. Not a
  // separate popup stacked on top of this one: while set, this dialog shows THAT item's own
  // GearDetailsDialog (in read-only `viewOnly` mode) instead of its own content, so there's only
  // ever one modal shell on screen, and "← Back to Package" (that dialog's own button) returns
  // here by simply clearing this.
  const [viewingComponent, setViewingComponent] = useState<BookableGearKind | null>(null);
  // A package's color edition, e.g. "The Base Camper Kit (KHAKI)", so its bed/tent opens in that color.
  const editionColor = name.match(/\(([^)]+)\)\s*$/)?.[1];
  const openKind = (kind: BookableGearKind) => setViewingComponent(withDefaultVariant(kind, editionColor));
  const { lead, bestFor, rest } = splitBestForLine(description);
  const faqEntries = buildFaqEntries(name, depositAmount);
  const faqLinkTargets = useMemo(() => buildFaqLinkTargets(gearKinds), [gearKinds]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (viewingComponent) {
    return (
      <GearDetailsDialog
        kind={viewingComponent}
        quantity={0}
        onQuantityChange={() => {}}
        onClose={onClose}
        viewOnly={{ onBack: () => setViewingComponent(null) }}
      />
    );
  }

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
        aria-label={name}
      >
        <div className="relative">
          {/* No forced aspect ratio and no object-cover: the photo shows at its own proportions,
              never cropped, up to a height cap so a very tall photo still fits the popup. */}
          <div
            {...swipe}
            className="relative flex max-h-[65vh] w-full items-center justify-center overflow-hidden bg-surface-strong"
          >
            {gallery.length === 0 || imageFailed ? (
              <div className="flex h-56 w-full items-center justify-center">
                <GearPlaceholderIcon className="h-14 w-14 text-ink-faint" />
              </div>
            ) : (
              <>
                {/* iOS lock-screen trick: the same photo, blown up and heavily blurred, fills the
                    letterboxed space around the uncropped photo with ITS OWN colors instead of a
                    flat, unrelated box. Purely decorative — never the photo a customer is actually
                    looking at, so it's hidden from assistive tech. */}
                <img
                  src={gallery[activeIndex].src}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
                />
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  aria-label={`View larger image of ${name}`}
                  className="relative z-10 w-full"
                >
                  <img
                    src={gallery[activeIndex].src}
                    alt={name}
                    onError={() => setImageFailed(true)}
                    className="mx-auto max-h-[65vh] w-full object-contain drop-shadow-lg"
                  />
                </button>
              </>
            )}
            {!imageFailed && <GalleryNav count={gallery.length} index={activeIndex} onChange={setActiveIndex} />}
            {isOutOfStock && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
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
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Package{paxRange ? ` · ${paxRange}` : ''}</p>
            <h2 className="font-serif text-xl font-bold text-ink sm:text-2xl">{name}</h2>
            {bestFor && <p className="-mt-1 text-sm font-semibold text-accent">Best {lead} {bestFor}</p>}
          </div>

          {components && components.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">What's Included</p>
              <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
                {components
                  .filter((component) => classifyComponent(component) === 'item')
                  .sort((a, b) => categoryRank(a) - categoryRank(b))
                  .map((component, index) => {
                    const matched = matchComponentToGearKind(component, gearKinds);
                    return (
                      <li key={index} className="flex items-baseline gap-2">
                        <span className="w-7 shrink-0 text-right font-medium text-ink [font-variant-numeric:tabular-nums]">
                          {component.quantity}×
                        </span>
                        {matched ? (
                          <button
                            type="button"
                            onClick={() => openKind(matched)}
                            className="min-w-0 text-left text-accent underline underline-offset-2 hover:text-brand-forest-dark"
                          >
                            {componentLabel(component)}
                          </button>
                        ) : (
                          <span className="min-w-0">{componentLabel(component)}</span>
                        )}
                      </li>
                    );
                  })}
                {components
                  .filter((component) => classifyComponent(component) === 'gift')
                  .map((component, index) => (
                    <li key={`gift-${index}`} className="flex items-baseline gap-2">
                      <span className="w-7 shrink-0 text-right">🎁</span>
                      <span className="min-w-0">Free use of {componentLabel(component)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <PackageContents kit={{ includedItems, description: rest }} showAllItems />
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted p-3">
            <div>
              <p className="text-lg font-bold text-accent">
                {formatCurrency(pricing['48h'])}
                <span className="text-sm font-normal text-ink-muted"> / 48h</span>
              </p>
              <p className="text-xs text-ink-muted">{formatCurrency(pricing['72h'])} / 72h</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-ink-faint">Deposit</p>
              <p className="text-sm font-semibold text-ink">{formatCurrency(depositAmount)}</p>
            </div>
          </div>

          {!isOutOfStock && (
            <button
              type="button"
              onClick={onToggleSelected}
              className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
                isSelected
                  ? 'border border-line bg-surface text-ink hover:bg-surface-strong'
                  : 'bg-brand-forest text-white hover:bg-brand-forest-dark'
              }`}
            >
              {isSelected ? 'Remove from Cart' : 'Add to Cart'}
            </button>
          )}

          <ProductFaqSection entries={faqEntries} linkTargets={faqLinkTargets} onOpenKind={openKind} />

          {/* A second, unmissable exit — the ✕ over the photo is easy to miss on mobile, where this
              popup is a near-full-height sheet: after scrolling down to read the FAQ, this is the
              closest way out without scrolling back up to hunt for it. */}
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
