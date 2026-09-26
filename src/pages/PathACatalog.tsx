import { usePageMeta } from '../hooks/usePageMeta';
import { PAGE_META } from '../config/pageMeta';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MESSENGER_URL } from '../config/social';
import { ArrowRightIcon, CampfireIcon, ChevronDownIcon, GearPlaceholderIcon } from '../components/icons';
import BackLink from '../components/BackLink';
import ColorSwitch from '../components/ColorSwitch';
import GearDetailsDialog from '../components/GearDetailsDialog';
import PackageDetailsDialog from '../components/PackageDetailsDialog';
import { filterPackagesByColor, packageColorOptions } from '../utils/colorFilter';
import FilterPill from '../components/FilterPill';
import { sortGearKindsWithinCategories } from '../utils/gearOrder';
import ImageLightbox from '../components/ImageLightbox';
import { splitBestForLine } from '../utils/bestForLine';
import { sizeCapacityToShow, withDefaultVariant } from '../utils/gearVariants';
import { QuantityStepper } from './PathBCatalog';
import SocialIconLink from '../components/SocialIconLink';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/useCatalog';
import { byoGearKey, getGearKindPrice, useRental } from '../context/RentalContext';
import type { BookableGearKind, BookableGearSelection, DateRange, DurationPresetId, PackageKit } from '../types/gearbnb';
import { cartStockUses, subtractStock } from '../utils/packageStock';
import { decidePackageCheck, type PackageDateStock } from '../utils/packageDateStock';
import { usePackageDateStock } from '../hooks/usePackageDateStock';
import { useDateAwareGearKinds } from '../hooks/useGearDateStock';
import {
  DURATION_PRESETS,
  DURATION_PROMO_BADGES,
  getDurationRange,
  getSeventyTwoHourUpsellDelta,
  toAvailabilityTimestamp,
  MAX_BOOKING_DATE,
  TODAY,
} from '../utils/duration';
import { formatCurrency } from '../utils/format';
import { toRmsBrand, type RmsAvailabilityIssue, type RmsAvailabilityRequest, type RmsBookingGearLine } from '../utils/rmsApi';
import { useAvailabilityCheck } from '../hooks/useAvailabilityCheck';
import { cleanGearName } from '../utils/gearName';
import { describeAvailabilityIssue } from '../utils/availabilityIssue';

type PackageDuration = Extract<DurationPresetId, '48h' | '72h'>;

const PACKAGE_DURATION_PRESETS = DURATION_PRESETS.filter(
  (preset): preset is { id: PackageDuration; label: string; days: number } => preset.id !== '24h',
);

/** One shared label style for every control group in the filter card (Group Size, Rental Duration,
 *  Rental Dates) — they previously each carried their own copy, which is how they drifted out of
 *  alignment with one another. */
const CONTROL_LABEL_CLASS = 'mb-2 block text-[11px] font-bold uppercase tracking-wider text-ink-muted';
const HELPER_TEXT_CLASS = 'mt-1.5 text-xs text-ink-faint';
const DATE_FIELD_CLASS =
  'h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';
/** Shared sizing (no color) for every PackageCard status pill/button in its action slot — one
 *  place to keep them all the same compact mobile size instead of each repeating its own
 *  px-4 py-2.5 text-sm. Each call site appends its own bg/text color classes on top. */
const ACTION_SIZE_CLASS = 'w-full rounded-lg px-3 py-2 text-center text-xs font-semibold sm:px-4 sm:py-2.5 sm:text-sm';
/** The default, non-interactive/disabled-looking status pill — everything except "Remove from
 *  Cart" and the primary green CTA button, which supply their own colors on top of
 *  ACTION_SIZE_CLASS instead. */
const ACTION_CLASS = `${ACTION_SIZE_CLASS} bg-surface-strong text-ink-faint`;

function scrollToDurationPicker() {
  document.getElementById('package-duration-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

/** RMS-confirmed availability for whichever specific package (edition included) a card
 * currently represents. Deliberately never defaults to "available" while unconfirmed — 'idle'
 * (no dates yet) and 'checking' both render as neither available nor unavailable, so the UI can
 * never show a false in-stock state before the RMS has actually answered. `rate_limited` is its
 * own distinct state (not folded into `error`) — see PathACatalog's checkPackageAvailability,
 * whose job is specifically to keep customers out of this state during normal use; when it's still
 * reached (the RMS's per-IP limit already retried once and still said no), the customer deserves a
 * message that says so rather than the generic "couldn't check" text. */
type RmsAvailabilityState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'unavailable'; issues: RmsAvailabilityIssue[] }
  | { status: 'error' }
  | { status: 'rate_limited' }
  | { status: 'timeout' };

interface PackageCardProps {
  kit: PackageKit;
  dateRange: DateRange | null;
  selectedDuration: PackageDuration | null;
  /** The page-wide "which packages are free for these dates" lookup — see decidePackageCheck. */
  dateStock: PackageDateStock;
  /** The page-wide color the customer picked ("Black"/"Khaki"), if the page offers one — decides
   *  which edition of a multi-color kit this card shows and adds to the cart. */
  color?: string;
}

function PackageCard({ kit, dateRange, selectedDuration, dateStock, color }: PackageCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, addKit, removeKit, addKitExtra, removeKitExtra } = useRental();
  const [imageFailed, setImageFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // The specific edition chosen (if any) becomes the cart item's real identity — this is what
  // gets submitted as the booking's package_id, so "Khaki" must never silently save as "Black".
  // The edition matching the page-wide color; a kit with no such edition (or only one edition)
  // falls back to its first one.
  const selectedEdition =
    kit.editions?.find((edition) => color && edition.label.toLowerCase() === color.toLowerCase()) ?? kit.editions?.[0];
  const effectiveId = selectedEdition?.id ?? kit.id;
  // The RMS's own Package.packageNumber for whichever edition is actually selected — never the
  // Supabase row id — matching exactly what booking submission would send for this same selection.
  const effectivePackageCode = selectedEdition?.packageNumber ?? kit.packageNumber;
  const isSelected = cart.selectedKits.some((selected) => selected.id === effectiveId);
  const selectedExtraIds = cart.kitExtras[effectiveId] ?? [];
  // Extra inventory the customer attached to THIS package — sent alongside packageCode so the
  // RMS checks the package and every extra item against the same dates in one authoritative call
  // (it silently ignored bookingGears alongside a package before its fix; it now validates both).
  // NO_PACKAGE_ADD_ONS rather than an inline `?? []`: a fresh empty array each render would give
  // the availability effect below a new dependency every render and re-fire its request. The
  // reducer only replaces this array when the selection actually changes, so its identity is a
  // correct dependency as-is.
  const packageAddOnGears = cart.packageAddOns[effectiveId] ?? NO_PACKAGE_ADD_ONS;
  const addOnItemCount = packageAddOnGears.reduce((sum, gear) => sum + gear.quantity, 0);
  // Only the add-ons actually checked for the *next* checkout (see the checkbox Cart.tsx now gives
  // each one) belong in a live availability preview — an add-on left in the cart but unchecked
  // must never be treated as part of what the customer is about to book, even though it still
  // counts toward the "N add-ons added" hint above (packageAddOnGears/addOnItemCount, unchanged).
  // NO_PACKAGE_ADD_ON_KEYS mirrors NO_PACKAGE_ADD_ONS's own referential-stability reasoning.
  const selectedPackageAddOnKeys = cart.checkoutSelection.packageAddOnKeys[effectiveId] ?? NO_PACKAGE_ADD_ON_KEYS;
  const checkedPackageAddOnGears = useMemo(
    () => packageAddOnGears.filter((gear) => selectedPackageAddOnKeys.includes(byoGearKey(gear))),
    [packageAddOnGears, selectedPackageAddOnKeys],
  );
  const { gearKinds, gearCatalogState } = useCatalog();
  // Mirrors exactly when PackageAddOnsSection actually has something to show: it attaches to the
  // first selected kit only, and renders nothing on a failed or empty gear catalog — so the hint
  // can never point at a section that isn't there.
  const showAddOnsHint =
    cart.selectedKits[0]?.id === effectiveId &&
    (gearCatalogState === 'loading' || (gearCatalogState === 'ready' && gearKinds.length > 0));

  const displayImage = selectedEdition?.imageUrl || kit.imageUrl;
  // The actually-selected edition's OWN price/deposit/extra-day rate/stock status — never the
  // parent kit's own fields once an edition is selected, since each edition is a distinct real RMS
  // Package row that can be priced (and stocked) independently of its siblings. Falls back to the
  // kit's own fields when no edition is selected (a kit with no editions at all, or before the
  // customer has picked one) — see KitEdition's own doc comment.
  const effectivePricing = selectedEdition?.pricing ?? kit.pricing;
  const effectiveDepositAmount = selectedEdition?.depositAmount ?? kit.depositAmount;
  // "Out of stock" in the catalog snapshot only means none is free RIGHT NOW. Once the customer has
  // chosen dates and the RMS says the package is free for them, that no longer applies, so the card
  // stops calling it out of stock and lets the availability check decide.
  const snapshotOutOfStock = (selectedEdition ?? kit).isOutOfStock ?? false;
  const freeForChosenDates = dateStock.status === 'ready' && dateStock.canSelect.get(effectivePackageCode) === true;
  const effectiveIsOutOfStock = snapshotOutOfStock && !freeForChosenDates;
  // Each edition is its own real Package row with its own description — never the parent kit's
  // once an edition is selected, same reasoning as effectivePricing above. A kit with no editions
  // (or before one is picked) falls back to the kit's own description, unchanged from before.
  const effectiveDescription = selectedEdition?.description ?? kit.description;
  // Same "edition's own value, never the parent kit's" reasoning as effectivePricing/
  // effectiveDepositAmount above — see this file's own extraPerDayPrice comment near the 72h
  // duration control for why 0 (never an invented rate) is the right fallback.
  const effectiveExtraPerDayPrice = selectedEdition?.extraPerDayPrice ?? kit.extraPerDayPrice ?? 0;
  // Same "edition's own, never the parent kit's" reasoning — a Black and a Khaki edition are
  // distinct real Package rows and can genuinely include different components.
  const effectiveComponents = selectedEdition?.components ?? kit.components;
  // Same reasoning — a package gallery is per real Package row too, not shared across editions.
  const effectiveImages = selectedEdition?.images ?? kit.images;
  // The card's own compact "who is this for" line — see splitBestForLine's own doc comment for the
  // exact "Best for ..." first-line convention this reads. null (no such line yet) shows nothing
  // here; it never falls back to guessed content.
  const { lead, bestFor } = splitBestForLine(effectiveDescription);
  const price = selectedDuration ? effectivePricing[selectedDuration] : null;

  // Real, date-scoped availability — checked against the RMS's actual inventory/assignment data,
  // never computed locally. Each card owns its own useAvailabilityCheck instance; the shared
  // hook's own module-level coordinator (concurrency cap, in-flight dedup, rate-limit cooldown)
  // is what keeps N simultaneously-mounted cards from firing N simultaneous requests every time
  // `dateRange` changes, without merging any two DIFFERENT packages' answers together — see that
  // hook's own doc comment. Requires a genuinely complete selection — a valid `dateRange` AND a
  // valid `selectedDuration` — not raw dates alone: `dateRange` alone used to be enough to fire a
  // request, which meant a page load with dates restored from a previous session (but no duration
  // chosen yet on THIS visit — see PathACatalog's own page-scoped date-state doc comment) still
  // triggered every visible card's availability check immediately. `null` (nothing to check)
  // covers no dates yet, no duration yet, or an out-of-stock kit.
  // One shared lookup answers "free for these dates?" for every card at once (a date change used
  // to fire one availability request per card, which the RMS's per-minute limit could not always
  // absorb). A card only skips its own check when that lookup positively says available; anything
  // else, and any package already in the cart, still runs the precise check below.
  const checkSource = decidePackageCheck(dateStock, effectivePackageCode, isSelected, snapshotOutOfStock);
  const availabilityRequest: RmsAvailabilityRequest | null = useMemo(() => {
    if (!dateRange || !selectedDuration || effectiveIsOutOfStock || checkSource !== 'own') return null;
    const pickupAt = toAvailabilityTimestamp(dateRange.start, cart.tripDetails.preferredTime);
    const returnAt = toAvailabilityTimestamp(dateRange.end, cart.tripDetails.preferredTime);
    if (!pickupAt || !returnAt) return null;
    const bookingGears: RmsBookingGearLine[] = checkedPackageAddOnGears.map((gear) => ({
      category: gear.category,
      brand: toRmsBrand(gear.brand),
      model: gear.model,
      quantity: gear.quantity,
    }));
    return { pickupAt, returnAt, packageCode: effectivePackageCode, bookingGears };
  }, [dateRange, selectedDuration, cart.tripDetails.preferredTime, effectiveIsOutOfStock, effectivePackageCode, checkedPackageAddOnGears, checkSource]);

  const availabilityCheck = useAvailabilityCheck(availabilityRequest);
  // Maps the shared hook's status onto this card's own local shape. Every non-terminal-looking
  // status has an explicit branch so a card can never be left rendering "Checking availability…"
  // for a check that actually finished.
  const availability: RmsAvailabilityState =
    checkSource === 'available' && dateRange && selectedDuration
      ? { status: 'available' }
      : checkSource === 'checking' && dateRange && selectedDuration
        ? { status: 'checking' }
        : availabilityCheck.status === 'idle'
      ? { status: 'idle' }
      : availabilityCheck.status === 'checking'
        ? { status: 'checking' }
        : availabilityCheck.status === 'success'
          ? availabilityCheck.result?.available
            ? { status: 'available' }
            : { status: 'unavailable', issues: availabilityCheck.result?.issues ?? [] }
          : availabilityCheck.status === 'rate_limited'
            ? { status: 'rate_limited' }
            : availabilityCheck.status === 'timeout'
              ? { status: 'timeout' }
              : { status: 'error' };

  function handleAdd() {
    if (!user) {
      navigate('/login', {
        state: {
          from: location.pathname,
          mode: 'login',
          reason: 'Please log in or create an account to rent this package.',
        },
      });
      return;
    }
    if (selectedEdition) {
      // The edition's own price/deposit/extra-day rate/stock status — never the parent kit's own
      // (see effectivePricing's own comment above) — so what's added to the cart, priced, and
      // charged always matches the specific edition the customer actually picked.
      addKit({
        ...kit,
        id: selectedEdition.id,
        name: `${kit.name} (${selectedEdition.label})`,
        imageUrl: selectedEdition.imageUrl,
        pricing: selectedEdition.pricing,
        depositAmount: selectedEdition.depositAmount,
        extraPerDayPrice: selectedEdition.extraPerDayPrice,
        isOutOfStock: effectiveIsOutOfStock,
        description: selectedEdition.description,
        editions: undefined,
      });
    } else {
      addKit({ ...kit, isOutOfStock: effectiveIsOutOfStock });
    }
  }

  function handleRemove() {
    removeKit(effectiveId);
  }

  return (
    // p-2.5 below sm: the catalog grid is 2 columns even at the narrowest supported width (see the
    // grid below), so each card's own content column is already only ~170px wide there — p-4/p-5
    // was 32-40px lost to padding alone on a card that narrow, before any content.
    <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-2.5 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1.5 sm:gap-3">
        {/* aspect-square below sm: at a 2-column mobile grid the card is already only ~half the
            old single-column width, so the image needs no further height concession beyond a
            square crop — it now renders roughly a quarter the pixel area it did as a full-width
            single-column 4:3 image, which was the single largest contributor to mobile card
            height before this. sm+ (2-3 column desktop/tablet grid, unchanged) stays aspect-square
            too, so there's no longer a breakpoint-specific ratio to maintain here at all. */}
        <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-surface-strong">
          {imageFailed || !displayImage ? (
            <GearPlaceholderIcon className="h-10 w-10 text-ink-faint" />
          ) : (
            // A real button (not a click handler on a bare <img>), so it's keyboard-reachable and
            // reads correctly to assistive tech — opens the shared ImageLightbox for a larger,
            // full-screen view. Never the card's own Add/duration controls; those stay exactly
            // where they already were, unaffected by this.
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label={`View larger image of ${kit.name}`}
              className="h-full w-full"
            >
              <img
                src={displayImage}
                alt={kit.name}
                onError={() => setImageFailed(true)}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </button>
          )}
        </div>
        {lightboxOpen && (
          <ImageLightbox
            images={[{ src: displayImage, alt: kit.name }]}
            index={0}
            onClose={() => setLightboxOpen(false)}
            onNavigate={() => {}}
          />
        )}
        {detailsOpen && (
          <PackageDetailsDialog
            name={selectedEdition ? `${kit.name} (${selectedEdition.label})` : kit.name}
            imageUrl={displayImage}
            images={effectiveImages}
            description={effectiveDescription}
            includedItems={kit.includedItems}
            components={effectiveComponents}
            paxRange={kit.paxRange}
            pricing={effectivePricing}
            depositAmount={effectiveDepositAmount}
            isOutOfStock={effectiveIsOutOfStock}
            isSelected={isSelected}
            onToggleSelected={() => {
              if (isSelected) handleRemove();
              else handleAdd();
            }}
            onClose={() => setDetailsOpen(false)}
          />
        )}

        <div className="flex items-start justify-between gap-1.5 sm:gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink sm:text-base">{kit.name}</h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {effectiveIsOutOfStock && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400 sm:px-2 sm:text-xs">
                Out of Stock
              </span>
            )}
            {kit.paxRange && (
              <span className="rounded-full bg-surface-strong px-1.5 py-0.5 text-[10px] font-medium text-ink-muted sm:px-2 sm:text-xs">
                {kit.paxRange}
              </span>
            )}
          </div>
        </div>
        {/* "What's Included" moved out of the card entirely — it now lives only inside the "View
            Details" popup (PackageDetailsDialog). This slot shows the package's own "Best for ..."
            tagline instead, when one has been written (see splitBestForLine's own doc comment for
            the exact convention) — nothing here, never a fabricated placeholder, when it hasn't. */}
        {bestFor && <p className="-mt-1 text-xs font-medium text-accent sm:-mt-2 sm:text-sm">Best {lead} {bestFor}</p>}
        {/* Trial: opens the package's own "View Details" popup (Best For line, full description,
            FAQ, and everything that used to show inline here). */}
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="self-start text-[11px] font-medium text-accent underline underline-offset-2 sm:text-xs"
        >
          View Details
        </button>

        {isSelected && kit.extras && kit.extras.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-surface-muted p-2 sm:gap-2 sm:p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted sm:text-xs">Optional Add-ons</p>
            {kit.extras.map((extra) => {
              const isChecked = selectedExtraIds.includes(extra.id);
              return (
                <label key={extra.id} className="flex items-center justify-between gap-2 text-xs text-ink sm:text-sm">
                  <span className="flex items-center gap-1.5 sm:gap-2">
                    {extra.imageUrl && (
                      <img src={extra.imageUrl} alt="" className="h-6 w-6 rounded object-cover sm:h-8 sm:w-8" />
                    )}
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        isChecked ? removeKitExtra(effectiveId, extra.id) : addKitExtra(effectiveId, extra.id)
                      }
                      className="h-4 w-4 rounded border-line text-accent focus:ring-brand-forest"
                    />
                    {extra.name}
                  </span>
                  <span>{formatCurrency(extra.price)}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-2.5 flex flex-col gap-2 sm:mt-5 sm:gap-3">
        <div className="flex items-center justify-between border-t border-line-soft pt-2 sm:pt-3">
          {/* This row is already side-by-side (price left, deposit right) at every width — unlike
              the BYO gear card, there's no button sharing this row to squeeze against, so the
              72h-upsell/extra-day-rate hints below only ever needed `min-w-0` to wrap safely, never
              hiding on mobile. */}
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-ink-faint sm:text-xs">Package Price</p>
            <p className="text-sm font-bold text-ink sm:text-lg">
              {price !== null ? formatCurrency(price) : `${formatCurrency(effectivePricing['48h'])}–${formatCurrency(effectivePricing['72h'])}`}
            </p>
            {selectedDuration === '48h' && !effectiveIsOutOfStock && (
              <p className="text-xs font-medium text-accent">
                Add {formatCurrency(getSeventyTwoHourUpsellDelta(effectivePricing))} to rent for 72h instead
              </p>
            )}
            {selectedDuration === '72h' && !effectiveIsOutOfStock && effectiveExtraPerDayPrice > 0 && (
              <p className="text-xs font-medium text-ink-muted">+{formatCurrency(effectiveExtraPerDayPrice)} per extra day</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wide text-ink-faint sm:text-xs">Deposit</p>
            <p className="text-xs font-semibold text-ink sm:text-sm">{formatCurrency(effectiveDepositAmount)}</p>
          </div>
        </div>

        {/* A selected package's own action button becomes "Remove from Cart", so an availability
            failure would otherwise never reach the customer once they'd added it — including one
            caused by an extra add-on item rather than the package. The RMS names the specific
            offending line and its real availableCount, so that's what's shown here rather than a
            generic "unavailable": date-scoped availability can fail even for a quantity the
            catalog's own stock snapshot allowed. */}
        {isSelected && availability.status === 'unavailable' && availability.issues.length > 0 && (
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] dark:border-amber-400/30 dark:bg-amber-400/10 sm:px-3 sm:py-2 sm:text-xs"
          >
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Not available for your selected dates
            </p>
            <ul className="flex flex-col gap-0.5 text-amber-800/90 dark:text-amber-300/90">
              {availability.issues.map((issue) => (
                <li key={issue.name} className="break-words">
                  {describeAvailabilityIssue(issue)}
                  {issue.requested > 0 && ` (you asked for ${issue.requested})`}
                </li>
              ))}
            </ul>
            <p className="text-amber-800/90 dark:text-amber-300/90">
              Adjust the quantity below, or change your dates before checking out.
            </p>
          </div>
        )}

        {effectiveIsOutOfStock ? (
          <span className={ACTION_CLASS}>Out of Stock</span>
        ) : !selectedDuration ? (
          <button
            type="button"
            onClick={scrollToDurationPicker}
            className={`${ACTION_CLASS} transition-colors hover:bg-line`}
          >
            <span className="sm:hidden">Pick Duration</span>
            <span className="hidden sm:inline">Select Duration to Book</span>
          </button>
        ) : isSelected ? (
          // Already in the cart — removable regardless of what a later availability re-check says,
          // so a customer can never get stuck unable to remove a selection that just went stale.
          <button
            type="button"
            onClick={handleRemove}
            className={`${ACTION_SIZE_CLASS} border border-brand-forest bg-brand-forest/10 text-accent transition-colors hover:bg-brand-forest/15`}
          >
            Remove from Cart
          </button>
        ) : availability.status === 'checking' ? (
          <span className={ACTION_CLASS} aria-busy>
            Checking availability…
          </span>
        ) : availability.status === 'unavailable' ? (
          <div className="flex flex-col gap-1">
            <span className={ACTION_CLASS}>Unavailable for these dates</span>
            <p className="text-center text-[11px] text-ink-faint sm:text-xs">Try different dates, or check back later.</p>
          </div>
        ) : availability.status === 'rate_limited' ? (
          // Recoverable, never a permanent dead end: clicking this calls the same
          // useAvailabilityCheck().retry() PathBCatalog's own "Try again" already uses, bypassing
          // this card's cache and forcing a genuine new request — waiting alone was never enough
          // to clear this state (nothing auto-retries on a timer), so a real action is required.
          <button type="button" onClick={availabilityCheck.retry} className={`${ACTION_CLASS} transition-colors hover:bg-line`}>
            Availability check is busy. Tap to try again.
          </button>
        ) : availability.status === 'timeout' ? (
          <button type="button" onClick={availabilityCheck.retry} className={`${ACTION_CLASS} transition-colors hover:bg-line`}>
            Availability check timed out, tap to try again
          </button>
        ) : availability.status === 'error' ? (
          <button type="button" onClick={availabilityCheck.retry} className={`${ACTION_CLASS} transition-colors hover:bg-line`}>
            Couldn't check availability, tap to try again
          </button>
        ) : availability.status === 'idle' ? (
          <span className={ACTION_CLASS}>
            <span className="sm:hidden">Pick a start date</span>
            <span className="hidden sm:inline">Select a start date to check availability</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            className="w-full rounded-lg bg-brand-forest px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark sm:px-4 sm:py-2.5 sm:text-sm"
          >
            {user ? (
              <>
                <span className="sm:hidden">Book Now</span>
                <span className="hidden sm:inline">Available for your dates, Book This Package →</span>
              </>
            ) : (
              'Log In to Rent'
            )}
          </button>
        )}

        {/* Points a customer who just selected this package to the add-on section, which renders
            below the whole package grid — on a phone that can be several tall cards away, easy to
            never scroll to. Deliberately a single line of small link text rather than a banner or
            button: add-ons are optional, so nothing here should read as a next required step.
            Only on the package the add-ons actually attach to (the first selected kit, same rule
            PackageAddOnsSection uses), and never when the gear catalog has nothing to offer. */}
        {showAddOnsHint && (
          <button
            type="button"
            onClick={scrollToPackageAddOns}
            className="flex min-h-8 items-center justify-center gap-1.5 self-center rounded-md px-2 text-xs font-medium text-accent underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/40 sm:min-h-10 sm:text-sm"
          >
            <span className="sm:hidden">
              {packageAddOnGears.length > 0 ? `${addOnItemCount} add-on${addOnItemCount === 1 ? '' : 's'} · View` : 'Add-ons available'}
            </span>
            <span className="hidden sm:inline">
              {packageAddOnGears.length > 0
                ? `${addOnItemCount} optional add-on${addOnItemCount === 1 ? '' : 's'} added · View`
                : 'Optional add-ons available below'}
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Brings the add-on section into view and moves focus to it, so a keyboard or screen-reader user
 *  who activates the hint lands in the section rather than being left on the package card while
 *  the page scrolls away underneath them. */
function scrollToPackageAddOns() {
  const section = document.getElementById(PACKAGE_ADD_ONS_SECTION_ID);
  if (!section) return;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  section.focus({ preventScroll: true });
}

const PACKAGE_ADD_ONS_SECTION_ID = 'package-add-ons';

/** Shared empty value for a package with no add-ons — see its use in PackageCard. */
const NO_PACKAGE_ADD_ONS: BookableGearSelection[] = [];

/** Shared empty value for a package with no add-ons checked for checkout — see its use in PackageCard. */
const NO_PACKAGE_ADD_ON_KEYS: string[] = [];

/** The add-on category filter's "no filter" value. Every other value is a category string taken
 *  from the live gear catalog itself — none are defined here. */
const ALL_ADD_ON_CATEGORIES = '__all__';

/** Case-insensitive partial match on the catalog's own descriptive fields. `needle` must already
 *  be trimmed and lowercased; an empty needle matches everything. Category is included so a
 *  search like "chair" also finds items in a chair category whose names don't repeat the word. */
function matchesAddOnQuery(kind: BookableGearKind, needle: string): boolean {
  if (!needle) return true;
  return [kind.name, kind.brand, kind.model ?? '', kind.category].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

/**
 * One extra rentable item offered under a selected package. Deliberately mirrors the Build Your
 * Own catalog card's own presentation (square image with placeholder fallback, category eyebrow,
 * name, live price, "Available: N", out-of-stock scrim, QuantityStepper) so the section reads as
 * "the BYO inventory, offered as optional extras" — the client's stated ask — rather than as a
 * second, unrelated visual system. Deliberately NOT PathBCatalog's own GearCard: that card also
 * renders BYO-specific machinery (per-gear compatible add-ons, date-availability scrims fed by the
 * BYO page's own availability state) which has no meaning here, and exporting it would couple the
 * two pages far more than this needs.
 */
function PackageAddOnCard({
  kind,
  quantity,
  price,
  onQuantityChange,
}: {
  kind: BookableGearKind;
  quantity: number;
  /** Null until the customer has picked a duration — shows the 48h–72h range instead of a total. */
  price: number | null;
  onQuantityChange: (next: number) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isSelected = quantity > 0;

  return (
    // Two layouts from one card. Below `lg` it's a compact row — thumbnail left, details right —
    // because the square-image card is ~480px tall at phone width, which made a catalog of 30+
    // items an extremely long scroll. From `lg` up it's the same square-image card Build Your Own
    // uses, where the grid has room for it.
    <div
      className={`group flex flex-row gap-2.5 overflow-hidden rounded-2xl border bg-surface p-2.5 shadow-sm transition-all hover:shadow-md lg:flex-col lg:gap-0 lg:p-0 ${
        isSelected ? 'border-brand-forest ring-1 ring-brand-forest/30' : 'border-line'
      }`}
    >
      <div className="relative h-18 w-18 shrink-0 overflow-hidden rounded-xl bg-surface-strong lg:aspect-square lg:h-auto lg:w-full lg:rounded-none">
        {imageFailed || !kind.imageUrl ? (
          <div className="flex h-full w-full items-center justify-center">
            <GearPlaceholderIcon className="h-8 w-8 text-ink-faint lg:h-10 lg:w-10" />
          </div>
        ) : (
          <img
            src={kind.imageUrl}
            alt={kind.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        {isSelected && (
          <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-forest px-1.5 text-xs font-bold text-white shadow-sm lg:right-2 lg:top-2">
            {quantity}
          </span>
        )}
        {/* Explicitly black, never bg-ink: a dimming scrim over a photo must stay dark in both
            themes, and `ink` is pure white in Dark Mode. Same rule as the BYO card. The label is
            dropped on the small thumbnail, where it can't fit — "Unavailable" still shows in the
            quantity slot beside it, so the state is never conveyed by dimming alone. */}
        {!kind.canSelect && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
            <span className="hidden rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white lg:inline">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:gap-2 lg:p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{kind.category}</p>
          {kind.canSelect && (
            <span className="shrink-0 text-[11px] text-ink-faint">Available: {kind.availableCount}</span>
          )}
        </div>
        <h3 className="line-clamp-2 break-words text-sm font-medium leading-snug text-ink" title={cleanGearName(kind.name)}>
          {cleanGearName(kind.name)}
        </h3>
        {sizeCapacityToShow(withDefaultVariant(kind)) && (
          <p className="text-[11px] text-ink-muted">Size/Capacity: {sizeCapacityToShow(withDefaultVariant(kind))}</p>
        )}
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="self-start text-[11px] font-medium text-accent underline underline-offset-2"
        >
          View Details
        </button>

        {/* Stacked below `lg` so the quantity control gets the full width of the details column
            instead of being squeezed beside the price; side by side once the card is a wide square tile. */}
        <div className="mt-auto flex flex-col items-start gap-2 pt-1 lg:flex-row lg:items-end lg:justify-between lg:pt-2">
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-accent">
              {price !== null
                ? formatCurrency(price)
                : kind.pricing['48h'] === kind.pricing['72h']
                  ? formatCurrency(kind.pricing['48h'])
                  : `${formatCurrency(kind.pricing['48h'])}–${formatCurrency(kind.pricing['72h'])}`}
            </p>
            {quantity > 1 && price !== null && (
              <p className="text-[11px] text-ink-muted">Subtotal {formatCurrency(price * quantity)}</p>
            )}
          </div>
          {kind.canSelect ? (
            // Capped at the RMS's own availableCount — a convenience only; the RMS independently
            // re-validates the requested quantity server-side at availability check and booking.
            <QuantityStepper
              value={quantity}
              max={kind.availableCount}
              ariaLabel={kind.name}
              onChange={onQuantityChange}
            />
          ) : (
            <span className="shrink-0 text-xs font-medium text-ink-faint">Unavailable</span>
          )}
        </div>
      </div>
      {detailsOpen && (
        <GearDetailsDialog kind={withDefaultVariant(kind)} quantity={quantity} onQuantityChange={onQuantityChange} onClose={() => setDetailsOpen(false)} />
      )}
    </div>
  );
}

/**
 * "Add-on (Optional):" — the extra rentable inventory a customer can attach to the package they
 * just selected, without ever leaving this page for Build Your Own.
 *
 * Sourced from exactly the same live RMS gear catalog Build Your Own uses (`useCatalog().gearKinds`
 * — GET /api/customer/catalog/gear), grouped by that catalog's own category values. Nothing here
 * invents a product, price, stock level or category, and this deliberately does NOT filter down to
 * the package's GearPairing add-ons: the RMS now validates, prices and reserves arbitrary rentable
 * inventory sent as `bookingGears[]` alongside `packageCode`.
 *
 * Attaches to ONE package — the first selected kit, matching the single-package-per-booking rule
 * checkout already enforces — and stores into `cart.packageAddOns[kitId]`, never `byoGears`, so
 * the booking remains a package booking with extras rather than becoming a Build Your Own one.
 */
function PackageAddOnsSection({
  kitId,
  kitName,
  stockWindow,
}: {
  kitId: string;
  kitName: string;
  stockWindow: { pickupAt: string; returnAt: string } | null;
}) {
  const { gearCatalogState, kits } = useCatalog();
  // Extras are counted for the customer's chosen dates when there are any, see useDateAwareGearKinds.
  const catalogGearKinds = useDateAwareGearKinds(stockWindow);
  const { cart, setPackageAddOnQuantity } = useRental();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL_ADD_ON_CATEGORIES);

  const selected = cart.packageAddOns[kitId] ?? [];
  const selectedQuantities = new Map(selected.map((gear) => [byoGearKey(gear), gear.quantity]));
  const selectedItemCount = selected.reduce((sum, gear) => sum + gear.quantity, 0);
  // Gear already spoken for in the cart (each package's own components, plus any Build Your Own
  // lines and their add-ons) comes off each kind's stock before that kind is offered as an extra,
  // so a customer is never shown, and can't add, a unit the package itself will use. A kind left at
  // 0 is hidden unless it's already in the cart, so it can still be lowered. The availability call
  // each package card makes on every cart change stays the final say, for dates and anything this
  // local subtraction can't see.
  const stockUses = useMemo(() => cartStockUses(kits, cart), [kits, cart]);
  const { gearKinds, hiddenByPackage } = useMemo(() => {
    const adjusted = subtractStock(catalogGearKinds, stockUses);
    const kept: BookableGearKind[] = [];
    let hidden = 0;
    adjusted.forEach((kind, index) => {
      // Hidden only when the cart used up stock that was really there. A kind the RMS already
      // reports as out of stock still shows (as it always did), and a selected one always stays.
      const usedUp = kind.availableCount === 0 && catalogGearKinds[index].availableCount > 0;
      if (usedUp && !selected.some((gear) => byoGearKey(gear) === byoGearKey(kind))) hidden += 1;
      else kept.push(kind);
    });
    return { gearKinds: kept, hiddenByPackage: hidden };
  }, [catalogGearKinds, stockUses, selected]);
  const hasDuration = Boolean(cart.tripDetails.startDate && cart.tripDetails.returnDate);

  // Same category grouping the BYO catalog uses, in the catalog's own order — the categories
  // themselves are never re-sorted or invented here. Kinds WITHIN a category are sorted the same
  // way BYO's own catalog is (smallest-to-largest for Beds/Tables/Cooking, Ultra-light > Moon >
  // Kermit for Chairs, ...) — see sortGearKindsWithinCategories's own doc comment for why that
  // never touches category order/position, only the order of kinds inside each one.
  const grouped = useMemo(() => {
    const groups = new Map<string, BookableGearKind[]>();
    for (const kind of sortGearKindsWithinCategories(gearKinds)) {
      const existing = groups.get(kind.category);
      if (existing) existing.push(kind);
      else groups.set(kind.category, [kind]);
    }
    return [...groups.entries()];
  }, [gearKinds]);

  // Search and category narrow what's DISPLAYED only. They never touch the catalog, the cart, or
  // what gets submitted: a selected add-on that a filter hides stays selected, keeps its quantity,
  // and is still sent as bookingGears at checkout (the count in the header keeps that visible).
  const categories = grouped.map(([category]) => category);
  // Falls back to All if a refreshed catalog no longer has the chosen category, rather than
  // leaving the customer on a filter that silently matches nothing.
  const effectiveCategory = categories.includes(activeCategory) ? activeCategory : ALL_ADD_ON_CATEGORIES;
  const needle = query.trim().toLowerCase();
  const visibleGroups = grouped
    .filter(([category]) => effectiveCategory === ALL_ADD_ON_CATEGORIES || category === effectiveCategory)
    .map(([category, kinds]) => [category, kinds.filter((kind) => matchesAddOnQuery(kind, needle))] as const)
    .filter(([, kinds]) => kinds.length > 0);
  const visibleCount = visibleGroups.reduce((sum, [, kinds]) => sum + kinds.length, 0);
  const isFiltering = needle !== '' || effectiveCategory !== ALL_ADD_ON_CATEGORIES;

  function clearFilters() {
    setQuery('');
    setActiveCategory(ALL_ADD_ON_CATEGORIES);
  }

  if (gearCatalogState === 'error') return null;

  return (
    // scroll-mt clears the sticky header (57px below lg, 110px from lg up) when the package card's
    // hint scrolls here; tabIndex -1 lets that hint move focus to the section without adding it
    // to the normal Tab order.
    <section
      id={PACKAGE_ADD_ONS_SECTION_ID}
      tabIndex={-1}
      aria-labelledby="package-add-ons-heading"
      className="flex scroll-mt-20 flex-col gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm outline-none sm:gap-4 sm:p-6 lg:scroll-mt-32"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="package-add-ons-heading" className="text-base font-bold text-ink sm:text-lg">
            Add-on (Optional):
          </h2>
          {selectedItemCount > 0 && (
            <span className="rounded-full bg-brand-forest/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
              {selectedItemCount} add-on{selectedItemCount === 1 ? '' : 's'} selected
            </span>
          )}
        </div>
        <p className="text-sm text-ink-muted">
          Want to add more gear to your rental? These are extra items rented on top of{' '}
          <span className="font-medium text-ink">{kitName}</span>, they are not part of the package
          contents, and everything starts at 0.
        </p>
        {hiddenByPackage > 0 && (
          <p className="text-xs text-ink-faint">
            Gear that <span className="font-medium">{kitName}</span> already uses isn&rsquo;t offered here once none is left over.
          </p>
        )}
      </div>

      {gearCatalogState === 'ready' && grouped.length > 0 && (
        <div className="flex flex-col gap-3">
          <label className="group relative block">
            <span className="sr-only">Search add-ons</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-accent" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search add-ons"
              className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-10 text-sm text-ink shadow-sm outline-none transition-colors [&::-webkit-search-cancel-button]:appearance-none focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-strong hover:text-ink"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </label>

          {categories.length > 1 && (
            // One swipeable row on phones — wrapping ten chips there would stack into a block of
            // buttons taller than the cards it filters. It bleeds to the section's own edges
            // (-mx-4 / px-4 match the section's mobile padding) so chips scroll off-screen cleanly
            // instead of being cut against an inner margin. From `sm` up there's room, so it wraps.
            <div
              role="group"
              aria-label="Filter add-ons by category"
              // A partially-visible pill sliced mid-word at an edge read as broken, not
              // "scrollable" — this fades BOTH edges to transparent below `sm` instead (the left
              // edge cuts the exact same way once the row has been scrolled right), so a partial
              // pill on either side looks like an intentional "swipe for more" hint rather than a
              // glitch. Only below `sm`, where this row actually scrolls; it wraps (nothing to
              // fade) from `sm` up.
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,transparent_0%,black_8%,black_92%,transparent_100%)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 sm:[mask-image:none]"
            >
              {[ALL_ADD_ON_CATEGORIES, ...categories].map((category) => {
                const active = effectiveCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    aria-pressed={active}
                    className={`h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${
                      active ? 'bg-brand-forest text-white' : 'bg-surface-strong text-ink-muted hover:bg-line hover:text-ink'
                    }`}
                  >
                    {category === ALL_ADD_ON_CATEGORIES ? 'All' : category}
                  </button>
                );
              })}
            </div>
          )}

          {/* Announced to screen readers as results change, and shown visibly only while a filter is
              actually narrowing the list — an unfiltered "Showing 33 of 33" would just be noise. */}
          <p aria-live="polite" className={isFiltering ? 'text-xs text-ink-faint' : 'sr-only'}>
            Showing {visibleCount} of {gearKinds.length} add-on{gearKinds.length === 1 ? '' : 's'}
          </p>
        </div>
      )}

      {gearCatalogState === 'loading' ? (
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading add-ons">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
              <div className="aspect-square w-full bg-surface-strong" />
              <div className="flex flex-col gap-2 p-4">
                <div className="h-2.5 w-1/3 rounded bg-surface-strong" />
                <div className="h-3.5 w-3/4 rounded bg-surface-strong" />
              </div>
            </div>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
          No additional gear is available to add right now.
        </p>
      ) : visibleGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface-muted p-6 text-center">
          <p className="text-sm font-medium text-ink">No add-ons found.</p>
          <p className="text-xs text-ink-muted">Try a different search or category.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-1 text-sm font-semibold text-accent underline underline-offset-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5 sm:gap-6">
          {visibleGroups.map(([category, kinds]) => (
            <div key={category} className="flex flex-col gap-3">
              {/* Only under "All": with one category chosen, a heading would just repeat the
                  active chip directly above it. */}
              {effectiveCategory === ALL_ADD_ON_CATEGORIES && (
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{category}</h3>
              )}
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {kinds.map((kind) => {
                  const key = byoGearKey(kind);
                  return (
                    <PackageAddOnCard
                      key={key}
                      kind={kind}
                      quantity={selectedQuantities.get(key) ?? 0}
                      price={hasDuration ? getGearKindPrice(kind, cart.tripDetails) : null}
                      onQuantityChange={(next) => {
                        // Only an increase needs an account — lowering/removing is always allowed,
                        // matching every other cart mutation. RentalContext refuses the mutation
                        // itself while signed out; this is just the friendly redirect layer.
                        const current = selectedQuantities.get(key) ?? 0;
                        if (next > current && !user) {
                          navigate('/login', {
                            state: {
                              from: location.pathname,
                              mode: 'login',
                              reason: 'Please log in or create an account to add gear to your cart.',
                            },
                          });
                          return;
                        }
                        setPackageAddOnQuantity(kitId, kind, next);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function PathACatalog() {
  usePageMeta(PAGE_META.packages.title, PAGE_META.packages.description);
  const { kits, catalogState, retryCatalog, packageDetailsFailed } = useCatalog();
  const { cart, totals, updateTripDetails } = useRental();
  const [searchQuery, setSearchQuery] = useState('');
  // Free-text guest count, not a capacity dropdown — see the Group Size audit note below.
  const [guestCountInput, setGuestCountInput] = useState('');
  // Page-scoped rental-selection UI state — deliberately NEVER seeded from the persisted
  // cart.tripDetails.startDate/returnDate, unlike before. cart.tripDetails is shared, cross-page
  // state that Checkout (and a returning customer's own persisted cart) still legitimately relies
  // on being restored — but that's exactly what let a page load with old dates already in
  // localStorage fire every visible package card's availability check before the customer had
  // done anything on THIS visit. This page's own Start Date/End Date/Rental Duration fields now
  // always start blank on a fresh mount (including a full browser refresh), regardless of what's
  // already persisted. Selecting a real value here still calls updateTripDetails normally (see
  // handleDurationSelect/handleStartDateChange/handleExtraDaysChange below), so cart.tripDetails
  // — and therefore Checkout — keeps receiving the customer's actual choice exactly as before;
  // only the reverse direction (persisted cart -> this page's own initial display) is removed.
  const [pageStartDate, setPageStartDate] = useState('');
  const [pageReturnDate, setPageReturnDate] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<PackageDuration | null>(null);
  const [extraDays, setExtraDays] = useState(0);

  const cartItemCount = cart.selectedKits.length + cart.selectedItems.length;

  // Memoized so its identity only changes when the actual dates do — PackageCard's availability
  // effect depends on this whole object, and without this it would re-fire on every unrelated
  // parent re-render (e.g. toggling the group-size filter) since a plain inline literal here would
  // be a new object every render.
  const dateRange: DateRange | null = useMemo(
    () => (pageStartDate && pageReturnDate ? { start: pageStartDate, end: pageReturnDate } : null),
    [pageStartDate, pageReturnDate],
  );

  // The dates every package card asks about, resolved once here so one lookup can serve them all.
  // Built exactly the way each card builds its own availability request (same timestamps), and null
  // in the same cases: no dates or no duration chosen yet.
  const stockWindow = useMemo(() => {
    if (!dateRange || !selectedDuration) return null;
    const pickupAt = toAvailabilityTimestamp(dateRange.start, cart.tripDetails.preferredTime);
    const returnAt = toAvailabilityTimestamp(dateRange.end, cart.tripDetails.preferredTime);
    return pickupAt && returnAt ? { pickupAt, returnAt } : null;
  }, [dateRange, selectedDuration, cart.tripDetails.preferredTime]);
  const packageDateStock = usePackageDateStock(stockWindow);

  // Checkout (TripDetailsForm/VerificationUpload) never asks how many people are on the trip — the
  // RMS's booking payload (RmsBookingSubmission) has no such field either — so this is genuinely
  // the only place that information could be collected, not a duplicate of something checkout
  // already asks. Free-text rather than a capacity dropdown: real Package rows have no `capacity`
  // column yet (see PackageKit.capacity's own comment), so the old "Group Size" pill row only ever
  // had "Any" to offer against live data — not broken code, just a filter with no real values to
  // filter by. A number the customer types themselves works today regardless of whether capacity
  // data ever gets populated admin-side, and a kit with unknown capacity is treated as "could fit"
  // rather than hidden — never invented, just not excluded for a value nobody has set yet.
  const parsedGuestCount = Number(guestCountInput);
  const hasValidGuestCount = guestCountInput.trim() !== '' && Number.isInteger(parsedGuestCount) && parsedGuestCount > 0;
  const guestCountError = guestCountInput.trim() !== '' && !hasValidGuestCount;

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const visibleKits = useMemo(() => {
    const byGuestCount = !hasValidGuestCount
      ? kits
      : kits.filter((kit) => kit.capacity <= 0 || kit.capacity >= parsedGuestCount);
    if (!normalizedSearch) return byGuestCount;
    return byGuestCount.filter((kit) =>
      [kit.name, kit.description].some((field) => field.toLowerCase().includes(normalizedSearch)),
    );
  }, [kits, hasValidGuestCount, parsedGuestCount, normalizedSearch]);

  // The one color switch for the whole page (Black/Khaki), built from every package edition's color.
  const [chosenColor, setChosenColor] = useState<string | null>(null);
  const colorOptions = useMemo(() => packageColorOptions(visibleKits), [visibleKits]);
  const activeColor =
    colorOptions.length > 1 ? (chosenColor && colorOptions.includes(chosenColor) ? chosenColor : colorOptions[0]) : undefined;
  // Strict: a package is shown only if it comes in the chosen color.
  const displayKits = activeColor ? filterPackagesByColor(visibleKits, activeColor) : visibleKits;

  function handleDurationSelect(preset: PackageDuration) {
    setSelectedDuration(preset);
    // Extra days only ever stack on top of 72h — switching to 48h always clears them, so a
    // previously-chosen "+2 extra days" can never silently reappear once 72h is picked again.
    const nextExtraDays = preset === '72h' ? extraDays : 0;
    setExtraDays(nextExtraDays);
    // Only recomputes the range when the customer has ALREADY picked a real start date (i.e. they
    // are changing their mind about duration). Picking a duration first no longer seeds a start
    // date of TODAY: that seeding made the selection look complete before the customer had chosen
    // anything, firing a full wave of availability requests for a date range nobody asked for, and
    // then a second full wave the moment they picked their actual start date — which is precisely
    // the doubled request count seen in the browser. With no start date yet, this leaves the range
    // empty, every card's request stays null, and not a single RMS call goes out until there is a
    // genuine selection to ask about.
    if (!pageStartDate) return;
    const range = getDurationRange(preset, pageStartDate, nextExtraDays);
    setPageStartDate(range.startDate);
    setPageReturnDate(range.returnDate);
    // Still updates the shared cart normally — Checkout (and a returning visit to this same page)
    // continues to see exactly what the customer just chose, unchanged from before this fix.
    updateTripDetails(range);
  }

  function handleStartDateChange(value: string) {
    if (!selectedDuration) return;
    // A date input can be cleared to '' (and a partially-typed date reads as invalid), which
    // getDurationRange would turn into an Invalid Date and throw on — clearing the field just
    // clears both dates instead, which the availability check already treats as "no range yet".
    if (!value || Number.isNaN(new Date(value).getTime())) {
      setPageStartDate('');
      setPageReturnDate('');
      updateTripDetails({ startDate: '', returnDate: '' });
      return;
    }
    const range = getDurationRange(selectedDuration, value, extraDays);
    setPageStartDate(range.startDate);
    setPageReturnDate(range.returnDate);
    updateTripDetails(range);
  }

  /** Only reachable while `selectedDuration === '72h'` (see the control itself) — clamped to never
   *  go negative, since there's no "-1 extra day" concept. */
  function handleExtraDaysChange(next: number) {
    const clamped = Math.max(0, next);
    setExtraDays(clamped);
    // Same reasoning as handleDurationSelect: with no start date chosen yet there is nothing to
    // recompute, and seeding TODAY here would fire a wave of availability checks for dates the
    // customer never picked. The value is remembered and applied as soon as they choose a date.
    if (!pageStartDate) return;
    const range = getDurationRange('72h', pageStartDate, clamped);
    setPageStartDate(range.startDate);
    setPageReturnDate(range.returnDate);
    updateTripDetails(range);
  }

  return (
    // pb-56 — see Cart.tsx's identical comment: this route's lifted floating buttons (both Need
    // Help and, once scrolled far enough, Back to Top) reach up to ~208px above the viewport
    // bottom, more than pb-28 (112px) cleared.
    <div className="flex min-h-screen flex-col pb-56">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-4 sm:gap-6 sm:p-6">
        <BackLink to="/catalog" label="Back to Browse Gear" />
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-lg font-semibold text-ink sm:text-xl">Choose a Package</h1>
          <p className="text-sm text-ink-muted">
            Ready-made kits, bundled and priced as a single unit. Deposits and rental terms follow our shared{' '}
            <Link to="/terms" className="font-medium text-accent underline underline-offset-2">
              Rental Agreement
            </Link>
            .
          </p>
        </div>

        {/* p-3 on phones: inside the page's own side padding, p-6 inset every field twice and
            left inputs noticeably narrower than the card around them. */}
        <div className="flex flex-col space-y-3 rounded-2xl border border-line/80 bg-surface-muted/60 p-3 shadow-sm sm:space-y-6 sm:p-6 md:p-8">
          {/* Row 1 — full-width search. */}
          <label className="group relative block">
            <span className="sr-only">Search packages</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-accent" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search packages by name…"
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-9 text-sm text-ink shadow-sm outline-none transition-colors [&::-webkit-search-cancel-button]:appearance-none focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-strong hover:text-ink"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </label>

          {/* Row 2 — guest count and rental duration side by side on desktop, stacked on mobile. */}
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-6">
            <div>
              <label htmlFor="guest-count" className={CONTROL_LABEL_CLASS}>
                Number of Guests / Pax
              </label>
              <input
                id="guest-count"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={guestCountInput}
                onChange={(e) => setGuestCountInput(e.target.value)}
                placeholder="e.g. 4"
                aria-invalid={guestCountError}
                aria-describedby="guest-count-hint"
                className={`w-full rounded-xl border bg-surface p-3 text-sm text-ink shadow-sm outline-none transition-colors focus:ring-2 ${
                  guestCountError
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500'
                    : 'border-line focus:border-brand-forest focus:ring-brand-forest/20'
                }`}
              />
              <p id="guest-count-hint" className={HELPER_TEXT_CLASS}>
                {guestCountError
                  ? 'Enter a whole number greater than 0.'
                  : 'Optional, we’ll show packages sized for your group where that’s known.'}
              </p>
            </div>

            <div id="package-duration-picker">
              <span className={CONTROL_LABEL_CLASS}>Rental Duration</span>
              {/* Duration pills and the extra-day stepper share one flex-wrap row so they read as
                  one control group, wrapping onto their own line naturally at narrower widths
                  rather than living in two visually separate stacked rows. */}
              <div className="flex flex-wrap items-center gap-3">
                {PACKAGE_DURATION_PRESETS.map((preset) => (
                  <FilterPill
                    key={preset.id}
                    selected={selectedDuration === preset.id}
                    onClick={() => handleDurationSelect(preset.id)}
                  >
                    {preset.label}
                    {DURATION_PROMO_BADGES[preset.id] && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          selectedDuration === preset.id ? 'bg-white/20 text-white' : 'bg-brand-forest/10 text-accent'
                        }`}
                      >
                        {DURATION_PROMO_BADGES[preset.id]}
                      </span>
                    )}
                  </FilterPill>
                ))}

                {/* Subtle, additive control — the 48h/72h pills above are untouched, exactly as
                    before. Only appears once 72h is actually selected, since extra days only ever
                    stack on top of that tier (48h has no "beyond" concept here). Each kit's own
                    price reacts live via getKitPrice; a kit with no admin-configured
                    extraPerDayPrice simply shows no change, which is correct — never an invented
                    charge. */}
                {selectedDuration === '72h' && (
                  <>
                    <span className="text-sm text-ink-muted">Want to rent longer?</span>
                    <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-1.5 py-1">
                      <button
                        type="button"
                        onClick={() => handleExtraDaysChange(extraDays - 1)}
                        disabled={extraDays === 0}
                        aria-label="Remove one extra day"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="min-w-[6.5rem] text-center text-sm font-medium text-ink">
                        {extraDays === 0 ? 'No extra days' : `+${extraDays} extra day${extraDays > 1 ? 's' : ''}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExtraDaysChange(extraDays + 1)}
                        aria-label="Add one extra day"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
                      >
                        +
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Both dates read from THIS page's own pageStartDate/pageReturnDate state, not the
              shared cart trip details — see this page's own doc comment on why: a fresh mount
              (including a full browser refresh) must show blank fields regardless of whatever's
              already persisted from an earlier visit. Selecting a real value still writes through
              to updateTripDetails normally, so Checkout's own Trip Details form keeps seeing it. */}
          <div>
            <span className={CONTROL_LABEL_CLASS}>Rental Dates</span>
            {/* grid-cols-2 at every width (not stacked until md): both fields are native date
                inputs — compact by nature, and on a touch device tapping either one opens the
                system's own date picker regardless of how wide the field itself renders — so
                stacking them into two full-width rows on phones was spending a whole extra row of
                height for no readability benefit. gap-3 (not gap-4) keeps the two fields from
                crowding each other at the narrowest supported width (320px). */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Start Date</span>
                <input
                  type="date"
                  value={pageStartDate}
                  min={TODAY}
                  max={MAX_BOOKING_DATE}
                  disabled={!selectedDuration}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className={`${DATE_FIELD_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                />
              </label>
              {/* Read-only by design, never a free-form input: a package is only bookable at the
                  48h or 72h tier (see PACKAGE_DURATION_PRESETS and getKitPrice), so the end date is
                  fully determined by the chosen duration. Letting it be typed freely would produce
                  rental periods this catalog's own pricing can't price. It also makes an invalid
                  range (end before start) structurally impossible rather than merely validated.
                  `disabled` (not just `readOnly`) stays on purpose — a native date input's own
                  calendar-picker UI otherwise ignores `readOnly` in some browsers — but it now
                  shares Start Date's exact bg/border/radius/height instead of a dimmed/greyed
                  treatment, so it reads as "this is the answer" rather than "this is broken". */}
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">End Date</span>
                <input
                  type="date"
                  value={pageReturnDate}
                  readOnly
                  disabled
                  className={`${DATE_FIELD_CLASS} cursor-not-allowed`}
                />
              </label>
            </div>
            <p className={HELPER_TEXT_CLASS}>
              {selectedDuration
                ? `Your end date is set automatically from the ${
                    PACKAGE_DURATION_PRESETS.find((preset) => preset.id === selectedDuration)?.label ?? 'selected'
                  } rental duration${extraDays > 0 ? ` plus ${extraDays} extra day${extraDays > 1 ? 's' : ''}` : ''} above.`
                : 'Select a rental duration above to choose your rental dates.'}
            </p>
          </div>
        </div>

        {catalogState === 'loading' && (
          <div className="grid grid-cols-2 animate-pulse gap-2.5 sm:gap-4 lg:grid-cols-3" aria-busy="true" aria-label="Loading package catalog">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <div className="aspect-square w-full bg-surface-strong" />
                <div className="flex flex-col gap-2 p-4">
                  <div className="h-2.5 w-1/3 rounded bg-surface-strong" />
                  <div className="h-3.5 w-3/4 rounded bg-surface-strong" />
                  <div className="mt-2 h-5 w-1/2 rounded bg-surface-strong" />
                </div>
              </div>
            ))}
          </div>
        )}

        {catalogState === 'error' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
            <p className="text-sm text-red-600 dark:text-red-400">
              We couldn't load the package catalog right now. Please try again shortly.
            </p>
            <button
              type="button"
              onClick={retryCatalog}
              className="rounded-lg border border-red-300 bg-surface px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Try Again
            </button>
          </div>
        )}

        {catalogState === 'ready' && kits.length === 0 && (
          <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
            No packages are available right now, check back soon!
          </p>
        )}

        {catalogState === 'ready' && kits.length > 0 && (
          displayKits.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
              No packages match {normalizedSearch ? `"${searchQuery.trim()}"` : 'this guest count'}. Try a different
              search or guest count.
            </p>
          ) : (
            // grid-cols-2 below sm (not stacked to 1): a mobile catalog should show several package
            // cards per viewport, not one giant card at a time — see PackageCard's own p-2.5/
            // aspect-square comments for how its content was compacted to actually fit that width.
            <>
              {activeColor && <ColorSwitch colors={colorOptions} active={activeColor} onChange={setChosenColor} />}
              {packageDetailsFailed && (
                <p role="status" className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-xs text-ink-muted">
                  Some package details (photos, what&rsquo;s included and live stock) couldn&rsquo;t load just now. You can still browse and book, or refresh the page to try again.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
                {displayKits.map((kit) => (
                  <PackageCard
                    key={kit.id}
                    kit={kit}
                    dateRange={dateRange}
                    selectedDuration={selectedDuration}
                    dateStock={packageDateStock}
                    color={activeColor}
                  />
                ))}
              </div>
            </>
          )
        )}

        {/* Appears directly below the packages the moment one is actually selected — the customer
            never has to leave for Build Your Own to add an extra light/bed/stove. Attached to the
            first selected kit, matching the one-package-per-booking rule checkout enforces. */}
        {cart.selectedKits.length > 0 && (
          <PackageAddOnsSection kitId={cart.selectedKits[0].id} kitName={cart.selectedKits[0].name} stockWindow={stockWindow} />
        )}

        {/* Contextual help right where indecision actually happens — after browsing every
         * package, not layered on top of any card or its Select Duration/Book action. Compact,
         * green-tinted horizontal banner (never a package-card lookalike) per the client's
         * reference: help copy + icon on the left, a dark "Message Us" pill and small social row
         * on the right. */}
        <div className="rounded-2xl border border-brand-forest/15 bg-brand-forest/5 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-sm sm:h-11 sm:w-11">
                <CampfireIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-bold text-ink sm:text-lg">Still deciding?</h2>
                <p className="text-xs text-ink-muted sm:text-sm">
                  Message us and we&rsquo;ll help you choose the right setup for your adventure.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <a
                href={MESSENGER_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Message Us on Messenger (opens in a new tab)"
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-forest px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark sm:px-5 sm:py-2.5 sm:text-sm"
              >
                Message Us
                <ArrowRightIcon className="h-4 w-4" />
              </a>
              <div className="flex items-center gap-2.5">
                <SocialIconLink platform="messenger" size="sm" />
                <SocialIconLink platform="facebook" size="sm" />
                <SocialIconLink platform="tiktok" size="sm" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              {cartItemCount} item{cartItemCount === 1 ? '' : 's'} selected
            </span>
            <span className="text-sm font-semibold text-ink">
              Deposit {formatCurrency(totals.dueToday)}
              <span className="mx-1.5 text-ink-faint">&bull;</span>
              Rental Fee {formatCurrency(totals.dueBeforeStart)}
            </span>
          </div>
          <Link
            to="/cart"
            className="rounded-lg bg-brand-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
          >
            Go to Cart &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
