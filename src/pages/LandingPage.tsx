import { usePageMeta } from '../hooks/usePageMeta';
import { PAGE_META } from '../config/pageMeta';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CampSetupsGallery from '../components/CampSetupsGallery';
import { CAMP_SETUP_PHOTOS } from '../config/campSetups';
import FaqAccordion, { type FaqItem } from '../components/FaqAccordion';
import { HOME_FAQ } from '../config/homeFaq';
import ImageLightbox from '../components/ImageLightbox';
import PathSelectionCards from '../components/PathSelectionCards';
import SocialIconLink from '../components/SocialIconLink';
import StepArrow, { STEP_GRID_GAP } from '../components/StepArrow';
import {
  BeginnerFriendlyIcon,
  EasyConvenientIcon,
  IconSpot,
  MemorableTripsIcon,
  QualityGearIcon,
} from '../components/GearbnbIcons';
import { ChatBubbleIcon, CheckCircleIcon, ChevronIcon, GearPlaceholderIcon } from '../components/icons';
import { useCatalog } from '../context/useCatalog';
import type { BookableGearKind, PackageKit } from '../types/gearbnb';
import { formatCurrency } from '../utils/format';
import { orderGearKinds } from '../utils/gearOrder';
import { sizeCapacityToShow, splitKindsByColor } from '../utils/gearVariants';
import { parsePackageContentsFromText, summarizeIncludedCategories } from '../utils/packageContents';
import { cleanGearName } from '../utils/gearName';

interface ProcessStep {
  title: string;
  description: string;
}

const PROCESS_STEPS: ProcessStep[] = [
  {
    title: 'Select Gear',
    description: "Choose between selecting our pre-selected camping packages or build your own setup.",
  },
  {
    title: 'Verify & Book',
    description: 'Submit trip dates, fulfillment preference (pickup/delivery), and identity verification documents.',
  },
  {
    title: 'Deposit & Admin Review',
    description: 'Pay the refundable security deposit within 24 hours while we review your documents. Your gear is reserved once you are approved.',
  },
  {
    title: 'Pick Up or Delivery',
    description: 'Pick up your camping gear in Las Piñas City or have it delivered by Lalamove or Grab on your start date.',
  },
];

const CATALOG_PAGE_SIZE = 8;

function CatalogPreviewCard({ kind }: { kind: BookableGearKind }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-sm sm:gap-3 sm:p-4">
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-surface-strong">
        {imageFailed || !kind.imageUrl ? (
          <GearPlaceholderIcon className="h-10 w-10 text-ink-faint" />
        ) : (
          // This card otherwise has no click behavior of its own (unlike BundleSlide below, which
          // is deliberately one whole-card button) — nothing to conflict with here.
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label={`View larger image of ${kind.name}`}
            className="h-full w-full"
          >
            <img
              src={kind.imageUrl}
              alt={kind.name}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          </button>
        )}
        {!kind.canSelect && (
          <span className="absolute rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white">Out of Stock</span>
        )}
      </div>
      {lightboxOpen && kind.imageUrl && (
        <ImageLightbox
          images={[{ src: kind.imageUrl, alt: kind.name }]}
          index={0}
          onClose={() => setLightboxOpen(false)}
          onNavigate={() => {}}
        />
      )}
      <div>
        <h3 className="text-sm font-semibold text-ink">{cleanGearName(kind.name)}</h3>
        <p className="text-xs text-ink-faint">{kind.category}</p>
        {sizeCapacityToShow(kind) && <p className="text-xs text-ink-muted">Size/Capacity: {sizeCapacityToShow(kind)}</p>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-accent">From {formatCurrency(kind.pricing['48h'])}</p>
        {kind.canSelect && <span className="shrink-0 text-[11px] text-ink-faint">Avail: {kind.availableCount}</span>}
      </div>
    </div>
  );
}

/** One card in the homepage "Adventure Bundles" catalog — redesigned to match the client's
 * reference "Our Packages" card: image, name, short description, a compact real-inclusions
 * summary, and an understated "View details →" affordance, rather than the previous
 * image-and-price-only slide. The whole card stays the single click target (same navigation
 * behavior as before — every prior click landed here too), so "View details" is styled text
 * inside it rather than a second nested interactive element. */
function BundleSlide({ kit, onSelect }: { kit: PackageKit; onSelect: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const categories = useMemo(() => summarizeIncludedCategories(kit), [kit]);
  const hasUpgradeOptions = Boolean(kit.extras && kit.extras.length > 0);
  // On live data, `description` sometimes IS the inclusions list typed as one run-on string
  // (e.g. "1x 4 Person Blackdog Vinyl Tent 1x Groundsheet 1x Camping Fan ...") rather than actual
  // marketing copy — same detection PackageContents.tsx already uses. Showing that raw string as
  // a "short description" would just repeat the categories line below it, badly. Only genuine
  // prose (or the absence of any parseable item list) gets shown here.
  const hasStructuredItems = kit.includedItems.length > 0;
  const descriptionIsInclusionsDump = !hasStructuredItems && parsePackageContentsFromText(kit.description).length > 0;
  const showDescription = Boolean(kit.description) && !descriptionIsInclusionsDump;
  // Out of stock only when every edition (or the kit itself, if it has none) is unselectable.
  const outOfStock = kit.editions?.length ? kit.editions.every((edition) => edition.isOutOfStock) : kit.isOutOfStock;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-[78%] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-sm transition-all hover:border-brand-forest/40 hover:shadow-md sm:w-[46%] lg:w-[31%]"
    >
      {/* Image shown in full, unobstructed — no dark scrim or overlaid text on top of it, since
       * the packages' own promotional artwork already carries plenty of detail worth seeing. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-strong">
        {outOfStock && (
          <span className="absolute right-2 top-2 z-10 rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white">
            Out of Stock
          </span>
        )}
        {imageFailed || !kit.imageUrl ? (
          <div className="flex h-full w-full items-center justify-center">
            <GearPlaceholderIcon className="h-12 w-12 text-ink-faint" />
          </div>
        ) : (
          <img
            src={kit.imageUrl}
            alt={kit.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-serif text-base font-semibold text-ink">{kit.name}</h3>
        {showDescription && <p className="line-clamp-2 text-xs text-ink-muted">{kit.description}</p>}

        {/* Real inclusions, summarized to coarse categories rather than the full item list —
         * that level of detail lives on the actual catalog page this card links to. */}
        {categories.length > 0 && (
          <p className="text-xs text-ink-faint">
            {categories.join(' | ')}
            {hasUpgradeOptions && <span className="text-accent"> + Upgrade Options</span>}
          </p>
        )}

        <span className="mt-auto pt-2 text-sm font-semibold text-accent transition-colors group-hover:text-brand-forest-dark">
          View details &rarr;
        </span>
      </div>
    </button>
  );
}

/** Horizontal scroll-snap slider of package images — a lighter-weight showcase than a full card
 * grid, native touch/drag scrolling on mobile plus arrow buttons and dot pagination on larger
 * screens. No carousel library: just CSS scroll-snap and Element.scrollBy/scrollTo, consistent
 * with this app's existing no-extra-dependency approach. */
/** One slide's full stride in a slider track (its own width plus the gap after it). Every slide
 * in a track is the same width, so this is a reliable unit for both scrolling and index math. */
function getSlideStride(track: HTMLDivElement): number {
  const first = track.firstElementChild as HTMLElement | null;
  if (!first) return track.clientWidth;
  const second = track.children[1] as HTMLElement | undefined;
  const gap = second ? second.offsetLeft - first.offsetLeft - first.offsetWidth : 20;
  return first.offsetWidth + gap;
}

function BundleSlider({ kits, onSelect }: { kits: PackageKit[]; onSelect: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
    // The last slide can become fully visible before scrollLeft reaches a full extra stride
    // (the track simply runs out of room to scroll further), so scrollLeft/stride alone can
    // under-report the index once you're at the end — checking against the actual scroll max
    // first avoids the last dot/arrow state ever looking stuck one slide behind.
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    if (track.scrollLeft >= maxScrollLeft - 2) {
      setActiveIndex(kits.length - 1);
      return;
    }
    const stride = getSlideStride(track);
    const index = stride > 0 ? Math.round(track.scrollLeft / stride) : 0;
    setActiveIndex(Math.max(0, Math.min(kits.length - 1, index)));
  }

  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= kits.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-5 pb-2 sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        >
          {kits.map((kit) => (
            <BundleSlide key={kit.id} kit={kit} onSelect={onSelect} />
          ))}
        </div>

        {/* Arrow controls — hidden on touch-first small screens where dragging the track directly
         * is the natural interaction; shown from sm: up as a desktop/tablet convenience. Disabled
         * (not hidden) at either end, so their position never shifts as you page through. */}
        <button
          type="button"
          onClick={() => scrollByDirection('left')}
          disabled={atStart}
          aria-label="Previous package"
          className="absolute -left-4 top-[38%] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-md transition-all hover:bg-surface-strong disabled:pointer-events-none disabled:opacity-0 sm:flex"
        >
          <ChevronIcon direction="left" className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollByDirection('right')}
          disabled={atEnd}
          aria-label="Next package"
          className="absolute -right-4 top-[38%] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-md transition-all hover:bg-surface-strong disabled:pointer-events-none disabled:opacity-0 sm:flex"
        >
          <ChevronIcon direction="right" className="h-5 w-5" />
        </button>
      </div>

      {/* Dot pagination — shows how many packages there are and which one is in view; also a
       * direct jump-to-slide control, not purely decorative. */}
      {kits.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {kits.map((kit, index) => (
            <button
              key={kit.id}
              type="button"
              onClick={() => scrollToIndex(index)}
              aria-label={`Go to ${kit.name}`}
              aria-current={index === activeIndex}
              className={`h-2 rounded-full transition-all ${
                index === activeIndex ? 'w-6 bg-brand-forest' : 'w-2 bg-line hover:bg-ink-faint'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface Review {
  quote: string;
  author: string;
}

/** Real renters' reviews, word for word as they wrote them (Taglish and spelling kept). */
const REVIEWS: Review[] = [
  {
    quote:
      'First time campers kami and they were so accommodating and professional. Nagbigay sila ng instructions plus were so patient with my wife and I. Kung gusto nyo ng affordable, accommodating, and smooth transaction, highly recommend them.',
    author: 'Jethro Balang',
  },
  {
    quote:
      'Nag-rent kami ng camping gear sa GearBnB for our family camping tapos sobrang convenient ng experience. Kumpleto talaga yung camping package rental nila kaya hindi na namin kailangan bumili ng own stuff namin. Super linis at premium camping gears nila tapos affordable pa, and very helpful din sila sa pag-explain kung paano gamitin ang mga items kasi super baguhan talaga kami. Definitely worth checking kung naghahanap kayo ng camping gear rental dito sa Metro Manila.',
    author: 'Eizel Gomez',
  },
  {
    quote:
      'Had a smooth and hassle-free experience renting camping gear from them. The items were clean, complete, and in good condition. Very easy to coordinate with and highly recommended for anyone planning a camping trip!',
    author: 'Paul Andrada',
  },
  {
    quote:
      'Nag family camping kami last week and sobrang sulit because of Gearbnb. We were looking for affordable camping gears and nakita namin sila. Hindi tinipid sa quality tsaka super sulit ng tent and complete yung inclusions. Their reliable service made the whole trip stress-free. 100% recommended namin ng fam ko as a camping tent rental shop for anyone planning a trip. thank you again for the great service!',
    author: 'Raymond Chiong Jr.',
  },
  {
    quote:
      'Highly recommended and Gearbnb Rental! First time ko mag camping pero yung guidance nila at shared instructional videos sa akin nakatulong para magawa ko ng maayos yung setup. Aside from that yung owner/s napaka considerate sa mga requests ko na add-ons. Yung mga gears nila? Solid! Quality! Inulan kami that night at ang dami naming mga kasamahan na nag moist yung tent nila pero yung sa amin kinaya kahit buhos talaga yung ulan! Lastly, ang linis ng mga gears nila, tent, tables, fan, as in lahat maayos, medyo OA pero maayos kasi talaga. Salamat Gearbnb for being part of the core memory ng daughter ko. Til next camp, kasama naman buong family ko, message ulit ako sa inyo.',
    author: 'Stanley Tan',
  },
];

/** "Raymond Chiong Jr." -> "RC": the first letters of the first two words, for the avatar. */
function reviewerInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

const STAR_PATH =
  'M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.26 3.88a1 1 0 0 0 .95.69h4.08c.97 0 1.37 1.24.59 1.81l-3.3 2.4a1 1 0 0 0-.37 1.11l1.27 3.88c.3.92-.76 1.69-1.54 1.12l-3.3-2.4a1 1 0 0 0-1.18 0l-3.3 2.4c-.78.57-1.83-.2-1.54-1.12l1.27-3.88a1 1 0 0 0-.36-1.12l-3.3-2.4c-.79-.56-.38-1.8.58-1.8h4.08a1 1 0 0 0 .95-.7l1.26-3.87Z';

function FiveStars({ className }: { className: string }) {
  return (
    <span className="flex items-center gap-0.5 text-[#f5b400]">
      <span className="sr-only">Rated 5 out of 5</span>
      {Array.from({ length: 5 }, (_, star) => (
        <svg key={star} aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className={className}>
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

/**
 * An endless slider of review cards: the review in focus sits in the middle at full size, the ones
 * before and after it show at the sides, smaller and faded, and the last review is followed by the
 * first again. Swiping, the arrows, the dots or tapping a side card brings that review to the
 * middle.
 *
 * How it loops: once the app runs, the track holds three copies of the reviews and starts on the
 * middle one. Whenever scrolling stops on the first or last copy, the track jumps (no animation)
 * to the same review in the middle copy, so there are always reviews on both sides. The extra
 * copies are hidden from screen readers, and the pre-built HTML has a single copy, so every review
 * is read once, with or without JavaScript.
 */
const REVIEW_AUTO_SLIDE_MS = 10_000;
const REVIEW_COUNT = REVIEWS.length;

function ReviewSlider() {
  const trackRef = useRef<HTMLDivElement>(null);
  // One copy in the pre-built HTML; three once the app runs (see above).
  const [looping, setLooping] = useState(false);
  const slideCount = looping ? REVIEW_COUNT * 3 : REVIEW_COUNT;
  // Which card is in the middle of the track; the review it shows is position % REVIEW_COUNT.
  const [position, setPosition] = useState(0);
  const positionRef = useRef(0);
  const activeIndex = position % REVIEW_COUNT;
  // The one long review opened with "Read more"; closes again when the slide changes.
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  // Paused while the pointer or keyboard focus is on the slider, so it never moves mid-read.
  const [paused, setPaused] = useState(false);
  // Which cards are actually cut off at 5 lines at the current width (so "Read more" shows on a
  // phone for a review that fits on desktop). Measured, not guessed from the text length.
  const quoteRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [clamped, setClamped] = useState<boolean[]>([]);
  const settleTimer = useRef<number | undefined>(undefined);

  // Before the first paint: switch to three copies and start on the middle one.
  useLayoutEffect(() => setLooping(true), []);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!looping || !track) return;
    positionRef.current = REVIEW_COUNT;
    setPosition(REVIEW_COUNT);
    track.scrollTo({ left: getSlideStride(track) * REVIEW_COUNT, behavior: 'instant' });
  }, [looping]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      setClamped(quoteRefs.current.map((quote) => !!quote && quote.scrollHeight > quote.clientHeight + 1));
      // A new width means a new card stride: keep the same card in the middle.
      track.scrollTo({ left: getSlideStride(track) * positionRef.current, behavior: 'instant' });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [looping]);

  // Once scrolling has stopped on an outer copy, jump to the same review in the middle copy.
  // `scrollend` where the browser has it (fires after the finger lifts), otherwise a short pause.
  useEffect(() => {
    const track = trackRef.current;
    if (!looping || !track) return;
    const recenter = () => {
      const stride = getSlideStride(track);
      const at = Math.round(track.scrollLeft / stride);
      if (at >= REVIEW_COUNT && at < REVIEW_COUNT * 2) return;
      const middle = REVIEW_COUNT + (((at % REVIEW_COUNT) + REVIEW_COUNT) % REVIEW_COUNT);
      track.scrollTo({ left: stride * middle, behavior: 'instant' });
    };
    // Undefined (not null) in browsers without the event.
    if (track.onscrollend !== undefined) {
      track.addEventListener('scrollend', recenter);
      return () => track.removeEventListener('scrollend', recenter);
    }
    const onScroll = () => {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(recenter, 150);
    };
    track.addEventListener('scroll', onScroll);
    return () => {
      track.removeEventListener('scroll', onScroll);
      window.clearTimeout(settleTimer.current);
    };
  }, [looping]);

  // Auto-advance every 10 seconds, always forwards. Restarts after any manual move, stops while a
  // review is opened with "Read more" or the tab is hidden, and is off for visitors who ask for
  // reduced motion.
  useEffect(() => {
    if (paused || expandedIndex !== null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track || document.visibilityState !== 'visible') return;
      // Before the copies exist, the last review wraps back to the first.
      const next = looping ? position + 1 : (position + 1) % REVIEW_COUNT;
      track.scrollTo({ left: getSlideStride(track) * next, behavior: 'smooth' });
    }, REVIEW_AUTO_SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [position, expandedIndex, paused, looping]);

  // The track's side padding is half its width minus half a card, so at scrollLeft = position ×
  // stride that card sits exactly in the middle.
  function scrollToPosition(next: number) {
    const track = trackRef.current;
    if (!track) return;
    // Without the copies (before the app has started) the ends wrap round instead.
    const target = looping ? Math.max(0, Math.min(slideCount - 1, next)) : (next + REVIEW_COUNT) % REVIEW_COUNT;
    track.scrollTo({ left: getSlideStride(track) * target, behavior: 'smooth' });
  }

  /** The nearest card showing review `index`, for the dots. */
  const positionOf = (index: number) => position - activeIndex + index;

  function handleScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const next = Math.max(0, Math.min(slideCount - 1, Math.round(track.scrollLeft / getSlideStride(track))));
    if (next % REVIEW_COUNT !== activeIndex) setExpandedIndex(null);
    positionRef.current = next;
    setPosition(next);
  }

  return (
    <div
      aria-roledescription="carousel"
      aria-label="Renter reviews"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="flex w-full flex-col items-center"
    >
      {/* The track runs the full width of the screen (cancelling the section's side padding).
          Cards are 80% of it on phones, so the neighbours peek in at the edges, and 380px from
          `sm` up, so a couple of whole reviews show either side. The side padding (half the
          track minus half a card) is what lets a card reach the middle; the screen edges fade
          out. Sizes are in cqw (the track's own width), since a percentage would be measured
          against the section instead. */}
      <div className="@container -mx-5 w-[calc(100%+2.5rem)] sm:-mx-6 sm:w-[calc(100%+3rem)]">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="relative flex w-full snap-x snap-mandatory gap-3 overflow-x-auto px-[10cqw] py-3 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] sm:gap-5 sm:px-[calc(50cqw-190px)] [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        >
          {Array.from({ length: slideCount }, (_, slide) => {
            const index = slide % REVIEW_COUNT;
            const review = REVIEWS[index];
            // The first and last copies only exist for the loop: hidden from screen readers.
            const copy = looping && (slide < REVIEW_COUNT || slide >= REVIEW_COUNT * 2);
            return (
            <figure
              key={slide}
              aria-roledescription={copy ? undefined : 'slide'}
              aria-label={copy ? undefined : `${index + 1} of ${REVIEW_COUNT}`}
              aria-hidden={copy || undefined}
              onClick={() => slide !== position && scrollToPosition(slide)}
              className={`relative flex w-[80cqw] shrink-0 snap-center flex-col rounded-3xl bg-surface p-6 text-left transition duration-300 motion-reduce:transition-none sm:w-[380px] sm:p-7 ${
                index === activeIndex ? 'scale-100 opacity-100 shadow-xl' : 'scale-[0.92] cursor-pointer opacity-60 shadow-md'
              }`}
            >
              <span aria-hidden="true" className="pointer-events-none absolute right-5 top-1 font-serif text-8xl leading-none text-brand-forest/15">
                &ldquo;
              </span>
              <FiveStars className="h-4 w-4" />
              {/* Long reviews show 5 lines until "Read more" (the full text stays in the HTML), so
                  the longest one doesn't make the whole slider tall. */}
              <blockquote className="mt-4 text-pretty text-sm leading-relaxed text-ink sm:text-[15px]">
                <p
                  ref={(quote) => {
                    quoteRefs.current[slide] = quote;
                  }}
                  className={expandedIndex === index ? '' : 'line-clamp-5'}
                >
                  {review.quote}
                </p>
              </blockquote>
              {(clamped[slide] || expandedIndex === index) && (
                <button
                  type="button"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  aria-expanded={expandedIndex === index}
                  tabIndex={copy ? -1 : undefined}
                  className="mt-2 self-start text-xs font-semibold text-accent underline underline-offset-2 hover:text-brand-forest-dark"
                >
                  {expandedIndex === index ? 'Show less' : 'Read more'}
                </button>
              )}
              {/* mt-auto keeps the name at the bottom of every card, whatever the review's length. */}
              <figcaption className="mt-auto flex items-center gap-3 pt-5">
                <span className="flex w-full items-center gap-3 border-t border-line pt-4">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-forest text-sm font-bold text-white"
                  >
                    {reviewerInitials(review.author)}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">{review.author}</span>
                    <span className="flex items-center gap-1 text-xs text-ink-muted">
                      <CheckCircleIcon className="h-3.5 w-3.5 text-accent" />
                      GearBnB Renter
                    </span>
                  </span>
                </span>
              </figcaption>
            </figure>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => scrollToPosition(position - 1)}
          aria-label="Previous review"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronIcon direction="left" className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          {REVIEWS.map((review, index) => (
            <button
              key={review.author}
              type="button"
              onClick={() => scrollToPosition(positionOf(index))}
              aria-label={`Show review by ${review.author}`}
              aria-current={index === activeIndex}
              className={`h-2 rounded-full transition-all ${
                index === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => scrollToPosition(position + 1)}
          aria-label="Next review"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronIcon direction="right" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <IconSpot icon={icon} />
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-muted">{description}</p>
    </div>
  );
}

const FEATURES: FeatureCardProps[] = [
  {
    icon: QualityGearIcon,
    title: 'Quality Gear',
    description: 'Rent carefully selected gear from trusted outdoor brands without the cost of buying everything yourself.',
  },
  {
    icon: EasyConvenientIcon,
    title: 'Easy and Convenient',
    description: 'Choose what you need, book your rental, and enjoy camping without the hassle of storing or maintaining gear.',
  },
  {
    icon: BeginnerFriendlyIcon,
    title: 'Beginner-Friendly',
    description: 'Get practical recommendations to help you choose the right gear and feel confident on your first trip.',
  },
  {
    icon: MemorableTripsIcon,
    title: 'Made for Memorable Trips',
    description: 'Spend less time worrying about your setup and more time enjoying the outdoors with the people who matter.',
  },
];

// Same entries as the homepage's FAQPage schema (see config/homeFaq.ts).
const FAQ_ITEMS: FaqItem[] = HOME_FAQ.map(({ question, answer, link }) => ({
  question,
  answer: link ? (
    <>
      <p>{answer}</p>
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 font-semibold text-accent transition-colors hover:text-brand-forest-dark"
      >
        {link.label} <span aria-hidden="true">&rarr;</span>
      </a>
    </>
  ) : (
    answer
  ),
}));

/** The real camping brands GearBnB actually stocks — display-only marketing copy for the brand
 *  strip below. Deliberately not sourced from inventory: this is a curated marketing list, and
 *  reading it from live gear rows would make the strip silently change as stock comes and goes. */
const TRUSTED_BRANDS = ['Black Dog', 'Naturehike', 'Mountainhiker', 'Mobi Garden', 'Vidalido'];

export default function LandingPage() {
  usePageMeta(PAGE_META.home.title, PAGE_META.home.description);
  const navigate = useNavigate();
  const location = useLocation();
  const { kits, gearKinds: catalogGearKinds, gearCatalogState, retryGearCatalog } = useCatalog();
  // Every color of a multi-color kind gets its own card here (the Build Your Own page switches
  // between them with pills instead).
  const gearKinds = useMemo(() => orderGearKinds(splitKindsByColor(catalogGearKinds)), [catalogGearKinds]);
  const categories = useMemo(() => {
    const unique = Array.from(new Set(gearKinds.map((kind) => kind.category)));
    return ['All', ...unique];
  }, [gearKinds]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [catalogPage, setCatalogPage] = useState(1);

  const visibleItems: BookableGearKind[] =
    activeCategory === 'All' ? gearKinds : gearKinds.filter((kind) => kind.category === activeCategory);

  const catalogPageCount = Math.max(1, Math.ceil(visibleItems.length / CATALOG_PAGE_SIZE));
  const paginatedItems = visibleItems.slice(
    (catalogPage - 1) * CATALOG_PAGE_SIZE,
    catalogPage * CATALOG_PAGE_SIZE,
  );

  function handleCategorySelect(category: string) {
    setActiveCategory(category);
    setCatalogPage(1);
  }

  // The footer's "How renting works"/"Adventure Bundles" links navigate here with a `#section-id`
  // hash when clicked from another page (see Footer's goToHomeSection) — react-router does not
  // auto-scroll to a hash on navigation, so this is what actually finishes that jump once the
  // section exists in the DOM.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  return (
    <div className="flex flex-col">
      {/* Hero — the outer <section> itself carries NO horizontal padding, so the image/gradient
       * (`inset-0` against the section) span the full viewport width edge-to-edge; the text
       * content and the floating card each carry their own `px-5 sm:px-6` instead, so only THEY
       * (never the photo) stay clear of the screen edges. Vertical spacing is plain, predictable
       * padding on the content block — no `min-h`/`justify-center` — so the gap above the card
       * (button row → card) and the section below (card → next heading) are each controlled by
       * one number, not by how far actual content happens to sit from an arbitrary min-height.
       * Static: no scroll-driven show/hide, no fixed/sticky positioning. */}
      <section className="relative">
        <img
          src="/images/landing-hero.webp"
          alt="Dome tent with a camping chair and table on a grassy hill above a mountain lake at sunset"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-brand-forest/80" />

        {/* MAIN HERO CONTENT — ends after the button row. gap-4 on mobile (vs desktop's gap-6):
            the badge/heading/subtext/buttons stack is the same four blocks at every width, so
            this is the one number controlling the rhythm between all of them — desktop's gap-6
            carried straight onto a phone was noticeably more air between four stacked lines of
            text than the tightened heading below needs. */}
        {/* pb-24 at every width (not a separate, larger mobile value): the floating card below is
            pinned to this section's bottom edge and shifted down by exactly half its own height
            (`translate-y-1/2`), so how much of this padding is genuinely "clear" space above the
            card depends on the card's own height at that width — mobile's shorter stacked card
            (~158px) needs less clearance than desktop's single-row one (~100px) needed padding for
            in the first place, so the same 96px works for both without a mobile-only override. */}
        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-5 pb-24 pt-8 text-center sm:gap-6 sm:px-6 sm:pt-32">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Located in Las Piñas City
          </span>
          {/* text-2xl below sm (not text-3xl): keeps this heading from dominating the whole first
              screen on a short device. */}
          <h1 className="font-serif text-2xl font-bold leading-[1.2] tracking-tight text-white sm:text-5xl sm:leading-tight">
            Camping Gear for Rent in Metro Manila Made Easy
          </h1>
          <p className="max-w-xl text-base text-white">
            Great camping trips start with the right gear. Get reliable camping gear rental in Metro Manila, with tents,
            beds and full kits ready for pickup.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-white/20 transition-colors hover:bg-brand-forest-dark"
            >
              Rent Camping Gear
            </button>
            <button
              type="button"
              onClick={() => navigate('/plan-an-event')}
              className="rounded-lg border border-white/40 bg-transparent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/10"
            >
              Plan An Event
            </button>
          </div>
        </div>

        {/* FLOATING SUPPORT CARD — anchored to the Hero section's own bottom edge (`bottom-0`)
         * then shifted down by exactly half its own rendered height (`translate-y-1/2`), so it
         * straddles that edge regardless of how tall the card actually renders at any given
         * breakpoint. `inset-x-0` + an inner `mx-auto max-w-3xl` centers it horizontally without
         * a separate translate-x (avoids compounding two transforms on one element). */}
        <div className="absolute inset-x-0 bottom-0 z-20 translate-y-1/2 px-5 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <div className="w-full rounded-2xl border border-line bg-surface p-4 text-left shadow-lg sm:p-5">
              {/* gap-3 on mobile (vs desktop's gap-5): this stacks into two blocks below `sm`
                  (message, then social row) rather than desktop's single side-by-side row, so it
                  needs a tighter number of its own — desktop's spacing carried onto the stacked
                  version was the biggest single contributor to this card's mobile height. */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-forest text-white sm:h-10 sm:w-10">
                    <ChatBubbleIcon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <h2 className="text-sm font-bold text-ink sm:text-base">Not sure what to rent?</h2>
                    <p className="text-xs text-ink-muted sm:text-sm">
                      Send us a message and we&rsquo;ll help you find the right setup for your trip.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 sm:justify-end sm:gap-4 sm:border-l sm:border-line-soft sm:pl-5">
                  <SocialIconLink platform="messenger" showLabel size="sm" />
                  <SocialIconLink platform="facebook" showLabel size="sm" />
                  <SocialIconLink platform="tiktok" showLabel size="sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Path selection — extra top padding (beyond the section's own py-16 bottom) clears the
       * floating support card above, which straddles down into this section's own top edge. */}
      {/* pt-24 below sm (not pt-40): same reasoning as the hero's own pb-24 above — this only
          needs to clear the floating card's downward-protruding half (currently ~79px at mobile's
          shorter stacked card height) plus a comfortable gap, not a value sized for a much taller
          card that no longer exists at this width. */}
      <section className="px-5 pb-10 pt-24 sm:px-6 sm:pb-16 sm:pt-32">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">How Do You Want to Gear Up?</h2>
            <p className="max-w-xl text-sm text-ink-muted">
              Two ways to rent, both fully covered by our verification and split-payment protections.
            </p>
          </div>
          <PathSelectionCards roomyOnMobile />
        </div>
      </section>

      {/* How to rent — id targeted by the footer's "How renting works" link; this step-by-step
       * process is the actual "how to rent" content, so the link and id moved here from the path-
       * selection section above (which is about choosing a path, not the rental process itself). */}
      <section id="how-renting-works" className="bg-page-band px-5 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">
              How To Rent Camping Gear from GearBnB?
            </h2>
            <p className="max-w-2xl text-balance text-sm text-ink-muted">
              Camping is better when you get to focus on the adventure. That&rsquo;s why we make getting camping gear for rent simple, with four clear steps from picking your gear to pickup day.
            </p>
          </div>

          {/* The gap leaves room for the arrow between cards (see StepArrow). */}
          <div className={`grid sm:grid-cols-2 lg:grid-cols-4 ${STEP_GRID_GAP}`}>
            {PROCESS_STEPS.map((step, index) => (
              <div key={step.title} className="relative flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
                {/* "Step 1" sits close above the title. Bold heading-style text, but not a heading
                    itself, so each card keeps its title as its one heading. */}
                <div className="flex flex-col gap-1">
                  <span className="text-xl font-bold leading-tight text-accent sm:text-2xl">Step {index + 1}</span>
                  <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
                </div>
                <p className="text-sm text-ink-muted">{step.description}</p>
                {index < PROCESS_STEPS.length - 1 && <StepArrow skipOnTwoColumns={index === 1} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brand strip */}
      <section className="border-b border-line-soft px-5 py-10 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5">
          {/* text-ink (not the previous, low-contrast text-ink-faint) plus bold weight — client
              feedback was that this line didn't stand out enough against the section background. */}
          <p className="text-xs font-bold uppercase tracking-wide text-ink">
            Gear from names campers trust
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {TRUSTED_BRANDS.map((brand) => (
              <span key={brand} className="text-sm font-bold tracking-wide text-accent">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Catalog preview */}
      <section className="px-5 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">
              Browse Our Camping Gear for Rent
            </h2>
            <p className="max-w-xl text-sm text-ink-muted">
              High-quality camping gear rental in Metro Manila, with every piece ready for your next adventure.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => handleCategorySelect(category)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? 'bg-brand-forest text-white'
                    : 'bg-surface-strong text-ink-muted hover:bg-line'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* grid-cols-2 below sm (not stacked to 1): a single mobile column made each
              aspect-square product photo span the full card width (~350px) — visually one large
              dominant image per screen, even though this is a catalog grid rather than one hero
              image. Two columns roughly halves each photo's rendered size without touching the
              image files or CatalogPreviewCard's own square crop. */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {paginatedItems.map((kind) => (
              <CatalogPreviewCard key={`${kind.category}|${kind.brand}|${kind.model ?? ''}|${kind.color ?? ''}`} kind={kind} />
            ))}
          </div>

          {gearCatalogState === 'loading' && <p className="text-center text-sm text-ink-muted">Loading gear…</p>}
          {gearCatalogState === 'error' && (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-ink-muted">We couldn't load the gear catalog right now.</p>
              <button
                type="button"
                onClick={retryGearCatalog}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-surface-strong"
              >
                Try Again
              </button>
            </div>
          )}

          {catalogPageCount > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCatalogPage((page) => Math.max(1, page - 1))}
                disabled={catalogPage === 1}
                aria-label="Previous page"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronIcon direction="left" className="h-4 w-4" />
              </button>
              {Array.from({ length: catalogPageCount }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setCatalogPage(pageNumber)}
                  aria-current={catalogPage === pageNumber ? 'page' : undefined}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    catalogPage === pageNumber
                      ? 'bg-brand-forest text-white'
                      : 'text-ink-muted hover:bg-surface-strong'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCatalogPage((page) => Math.min(catalogPageCount, page + 1))}
                disabled={catalogPage === catalogPageCount}
                aria-label="Next page"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronIcon direction="right" className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/catalog/build-your-own')}
            className="mx-auto rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
          >
            View All Catalog
          </button>
        </div>
      </section>

      {/* Bundles — id targeted by the footer's "Adventure Bundles" link. */}
      <section id="adventure-bundles" className="px-5 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-balance font-serif text-2xl font-bold text-ink sm:text-3xl">
              Camping Bundles for Every Camper
            </h2>
            <p className="max-w-xl text-sm text-ink-muted">
              Ready-made packages that bundle everything you need into one simple booking.
            </p>
          </div>

          <BundleSlider kits={kits} onSelect={() => navigate('/catalog/camping-packages')} />

          <button
            type="button"
            onClick={() => navigate('/catalog/camping-packages')}
            className="mx-auto rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong"
          >
            View All Packages
          </button>
        </div>
      </section>

      {/* Why rent with us */}
      <section className="bg-page-band px-5 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
          {/* py-6 below sm (was py-10): only scoped to the mobile size step below — the badge
              itself still gets sm:py-10/lg:py-0 exactly as before from `sm` up. */}
          <div className="relative flex items-center justify-center py-6 sm:py-10 lg:py-0">
            {/* Soft brand-colored glow instead of a hard-edged card — keeps the logo feeling
             * intentional and grounded without boxing it in. */}
            <div
              className="pointer-events-none absolute inset-0 -z-10 opacity-70 [background:radial-gradient(42%_42%_at_50%_50%,color-mix(in_srgb,var(--color-brand-forest)_30%,transparent),transparent_70%)]"
              aria-hidden="true"
            />
            {/* The source file is a circular badge with a visible margin of solid white around it
             * inside a square image — a plain rounded-full crop still leaves a white ring behind
             * the badge, so the image is also scaled up until the badge itself fills the circular
             * frame, cropping the white margin away entirely (no separate transparent asset).
             * h-44 w-44 below sm (was h-64 w-64): at mobile widths this section stacks the badge
             * directly above the heading/benefit cards (no side-by-side room yet — that only
             * starts at `lg`), so its own height was pushing "Why Rent with GearBnB?" and all four
             * benefit cards down by a full extra 256px+padding before any of that text was ever
             * visible. sm:h-80 sm:w-80 (from `sm` up, including desktop) is unchanged — already a
             * balanced side-by-side pairing with the benefit-card grid there. */}
            <div className="h-44 w-44 overflow-hidden rounded-full drop-shadow-2xl sm:h-80 sm:w-80">
              <img
                src="/brand_assets/gearbnb-logo-960.webp"
                alt="GearBnB"
                className="h-full w-full scale-150 object-cover"
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">Why Rent with GearBnB?</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Get quality camping gear, helpful guidance, and a hassle-free rental experience designed to make
                every trip easier and more memorable.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="w-fit rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
            >
              Start Your Rental Today
            </button>
          </div>
        </div>

      </section>

      {/* Testimonials: real renters' reviews on a deep forest-to-navy gradient, lit by a warm
          golden glow (the stars' color) and a soft olive one, so the section pops against the
          light ones around it. All three gradient colors are dark enough for white text. */}
      <section className="relative isolate overflow-hidden bg-[linear-gradient(135deg,var(--color-brand-forest-dark)_0%,var(--color-brand-forest)_45%,var(--color-brand-navy)_100%)] px-5 py-12 sm:px-6 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(45%_55%_at_0%_0%,color-mix(in_srgb,var(--color-brand-olive)_45%,transparent),transparent_70%),radial-gradient(40%_50%_at_100%_100%,color-mix(in_srgb,#f6c445_22%,transparent),transparent_70%),radial-gradient(35%_30%_at_50%_0%,color-mix(in_srgb,var(--color-brand-cream)_12%,transparent),transparent_70%)]"
        />
        <div className="flex flex-col items-center gap-8 text-center sm:gap-10">
          <div className="flex max-w-5xl flex-col items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-cream">Testimonials</span>
            <h2 className="text-balance font-serif text-2xl font-bold text-white sm:text-4xl">What Our Renters Say</h2>
            <p className="max-w-xl text-sm text-white/80 sm:text-base">
              Real reviews from families, couples and first-time campers who rented their camping gear from GearBnB.
            </p>
          </div>
          <ReviewSlider />
        </div>
      </section>

      {/* View Our Camp Setups — the client's actual setup photos (see campSetups.ts). Renders a
       * "Photos coming soon" placeholder instead whenever that list is empty, rather than any
       * invented/stock image. */}
      <section className="bg-page-band px-5 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="font-serif text-2xl font-bold text-ink sm:text-3xl">View Our Camping Gear Rental Setups</h2>
            <p className="max-w-xl text-sm text-ink-muted">
              Take a look at our camping setups and real photos shared by our renters. Explore the gallery and get
              inspired for your next trip.
            </p>
          </div>

          <CampSetupsGallery photos={CAMP_SETUP_PHOTOS} />

          {/* Subtle closing nudge — only shown once there are real photos to be inspired by; the
              empty-state placeholder already has nothing to lead into yet. Soft tinted card
              (brand-forest at low opacity, not a literal glass/blur effect) rather than a plain
              text line, so the CTA reads as its own small moment instead of trailing off the
              gallery. Built from this site's own brand-forest token (not a raw emerald/stone
              utility) so it already matches the rest of the page and adapts correctly in dark
              mode along with everything else. */}
          {CAMP_SETUP_PHOTOS.length > 0 && (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-brand-forest/10 bg-brand-forest/5 p-8 text-center">
              <h3 className="font-serif text-lg font-semibold text-ink sm:text-xl">Ready to build your setup?</h3>
              <p className="max-w-sm text-sm text-ink-muted">
                Browse ready-made packages or build your own kit from individual gear.
              </p>
              <button
                type="button"
                onClick={() => navigate('/catalog')}
                className="mt-1 rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
              >
                Start Renting
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Conclusion + FAQ — the FAQ sits beside the closing CTA rather than as its own separate
       * section, per the client's requested layout. The FAQ card is deliberately a light surface
       * floating on the dark gradient (same pattern as the hero's own floating support card),
       * rather than trying to restyle FaqAccordion's rows for a dark background. */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-forest via-brand-forest-dark to-brand-navy px-5 py-10 sm:px-6 sm:py-16">
        {/* Soft radial glow behind the headline for depth — purely decorative, non-interactive. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(60%_80%_at_50%_0%,color-mix(in_srgb,var(--color-brand-olive)_35%,transparent),transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
            <h2 className="font-serif text-2xl font-bold text-white drop-shadow-sm sm:text-4xl">
              Camping Gear for Rent in Las Piñas City
            </h2>
            <p className="text-sm text-white">
              Make your next camping trip easier with{' '}
              <Link to="/about-us" className="underline underline-offset-2 hover:text-white/80">
                GearBnB
              </Link>
              . Pick up your gear at{' '}
              <a
                href="https://www.google.com/maps/place/GearBnB+Camping+Gears+Rental/@14.4461908,120.9966593,17z/data=!3m1!4b1!4m6!3m5!1s0x3397d3090cbbd26f:0x665f11a5d4c66dde!8m2!3d14.4461908!4d120.9966593!16s%2Fg%2F11z8h467l7?entry=ttu&g_ep=EgoyMDI2MDkxNi4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-white/80"
              >
                our location in Talon Uno, Las Piñas City
              </a>
              . We serve campers across Metro Manila, Calabarzon and nearby areas. Get the gear you need and spend more
              time outdoors with your people.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <button
                type="button"
                onClick={() => navigate('/catalog')}
                className="rounded-lg border border-white/50 bg-transparent px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-white hover:bg-white/10"
              >
                Explore All Gear
              </button>
              <button
                type="button"
                onClick={() => navigate('/catalog')}
                // Deliberately text-brand-forest, not text-accent — this button's background is a
                // literal bg-white in every theme, and accent's dark-mode value (a light mint) would
                // be low-contrast against that constant white, unlike every other text-accent usage
                // on this site, which sits on a theme-aware dark surface instead.
                className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-forest shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-cream hover:shadow-lg"
              >
                Reserve Now &rarr;
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-center text-lg font-semibold text-white lg:text-left">Frequently Asked Questions</h3>
            <FaqAccordion items={FAQ_ITEMS} />
          </div>
        </div>
      </section>

    </div>
  );
}
