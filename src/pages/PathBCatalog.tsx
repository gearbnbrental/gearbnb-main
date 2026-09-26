import { usePageMeta } from '../hooks/usePageMeta';
import { PAGE_META } from '../config/pageMeta';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BackLink from '../components/BackLink';
import FilterPill from '../components/FilterPill';
import { ChevronIcon, GearPlaceholderIcon } from '../components/icons';
import ImageLightbox from '../components/ImageLightbox';
import GearDetailsDialog from '../components/GearDetailsDialog';
import { addOnAsGearKind } from '../utils/addOnAsKind';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/useCatalog';
import {
  byoGearKey,
  calculateRentalDurationDays,
  getGearKindPrice,
  useRental,
} from '../context/RentalContext';
import type {
  BookableAddOn,
  BookableAddOnSelection,
  BookableGearKind,
  DurationPresetId,
  TripDetails,
} from '../types/gearbnb';
import {
  DURATION_PRESETS,
  DURATION_PROMO_BADGES,
  durationFromDates,
  extraDaysFromDates,
  getDurationRange,
  getSeventyTwoHourUpsellDelta,
  toAvailabilityTimestamp,
  TODAY,
} from '../utils/duration';
import { formatCurrency } from '../utils/format';
import { toRmsBrand, type RmsAvailabilityRequest, type RmsAvailabilityResult } from '../utils/rmsApi';
import { useAvailabilityCheck } from '../hooks/useAvailabilityCheck';
import { resolveGearVariant, sizeCapacityToShow } from '../utils/gearVariants';
import ColorSwitch from '../components/ColorSwitch';
import { filterGearByColor, gearColorOptions, supportsColorFilter } from '../utils/colorFilter';
import { orderGearKinds } from '../utils/gearOrder';
import { splitBestForLine } from '../utils/bestForLine';
import { productNote } from '../utils/gearNote';
import { cleanGearName } from '../utils/gearName';

/** Mirrors the RMS's own customer-safe display-name construction
 * (src/server/availability/service.ts's kindDisplayName) exactly, so an
 * issue's `name` can be matched back to the gear card it's about. `kind.brand`
 * arriving from GET /api/customer/catalog/gear is already "Generic"-stripped
 * server-side, so no additional cleaning is needed here. */
function kindDisplayName(kind: { category: string; brand: string; model: string | null; color?: string }): string {
  const parts = [kind.brand, kind.model].filter(Boolean);
  const base = parts.length > 0 ? parts.join(' ') : kind.category;
  return kind.color ? `${base} (${kind.color})` : base;
}

const ITEMS_PAGE_SIZE = 9;

type ByoDuration = Extract<DurationPresetId, '48h' | '72h'>;

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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

// Client rule: there is no 24-hour rental tier — mirrors PathACatalog's identical filter.
const BYO_DURATION_PRESETS = DURATION_PRESETS.filter(
  (preset): preset is { id: ByoDuration; label: string; days: number } => preset.id !== '24h',
);

// Same label/field treatment as PathACatalog's filter card — kept as page-local constants (not a
// shared module) since they're just a few presentational class strings, matching how each page
// already owns its own small constants like BYO_DURATION_PRESETS above.
const CONTROL_LABEL_CLASS = 'mb-2 block text-[11px] font-bold uppercase tracking-wider text-ink-muted';
const HELPER_TEXT_CLASS = 'mt-1.5 text-xs text-ink-faint';
const DATE_FIELD_CLASS =
  'h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';

export interface QuantityStepperProps {
  value: number;
  max: number;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (next: number) => void;
  /** Below `sm` only, shrinks the +/- buttons and input a step down (32px, was 36px) — `sm` and
   *  up is always full size, unchanged. For a secondary control nested inside an already-selected
   *  card (e.g. AddOnRow's own compatible-add-on quantity, itself nested one level deeper than a
   *  gear kind's own card), never the primary "add this to your cart" tap target, which stays
   *  full size at every width. */
  compact?: boolean;
}

/**
 * +/- buttons AND direct numeric typing, both clamped to the same [0, max] range — `max` is
 * always the real, RMS-sourced availableCount for whatever this controls (a BYO gear kind or
 * add-on), never a client-invented ceiling. Typing (or pasting) a number above what's actually in
 * stock is clamped down to `max` with a visible "Only N available." message, exactly like the +
 * button already refuses to go higher — this is a UX convenience only: the RMS independently
 * re-validates the final requested quantity server-side at booking submission regardless (see
 * checkAvailability/createBookingFromCustomerPortal), so this client-side cap is never the actual
 * security boundary against overselling.
 */
export function QuantityStepper({ value, max, disabled, ariaLabel, onChange, compact = false }: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  // Keeps the field in sync with external changes (+/- clicks, a sibling control resetting this
  // selection, etc.) — but only while the customer isn't actively mid-edit, so a keystroke here
  // never gets clobbered by an unrelated re-render.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = Math.floor(Number(raw));
    if (raw.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(String(value));
      setError(null);
      return;
    }
    if (parsed > max) {
      setError(`Only ${max} available.`);
      setDraft(String(max));
      onChange(max);
      return;
    }
    setError(null);
    const clamped = Math.max(0, parsed);
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2" role="group" aria-label={ariaLabel}>
        <button
          type="button"
          disabled={disabled || value <= 0}
          onClick={() => onChange(value - 1)}
          aria-label={`Decrease ${ariaLabel}`}
          className={`flex items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40 ${
            compact ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-9 w-9'
          }`}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          step={1}
          disabled={disabled}
          value={draft}
          aria-label={`Quantity for ${ariaLabel}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className={`rounded-md border border-line bg-surface py-1 text-center font-semibold text-ink outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
            compact ? 'w-8 text-xs sm:w-12 sm:text-sm' : 'w-12 text-sm'
          }`}
        />
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${ariaLabel}`}
          className={`flex items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40 ${
            compact ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-9 w-9'
          }`}
        >
          +
        </button>
      </div>
      {error && (
        <span role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}

interface AddOnRowProps {
  addOn: BookableAddOn;
  quantity: number;
  hasDuration: boolean;
  price: number | null;
  showUpsell: boolean;
  /** True once the customer has already opted into the 72h tier — shows this add-on's own
   *  per-extra-day rate underneath its price, the mirror case of `showUpsell` (48h -> nudge toward
   *  72h; 72h -> show what going even longer costs). */
  showExtraDayRate: boolean;
  onChange: (next: number) => void;
}

// Exported so GearDetailsDialog's own "Optional Add-ons" section (a kind's compatible add-ons,
// shown inside the "View Details" popup too, not only on the card) reuses this exact row rather
// than a second copy — mirrors QuantityStepper's own cross-file export just below.
export function AddOnRow({ addOn, quantity, hasDuration, price, showUpsell, showExtraDayRate, onChange }: AddOnRowProps) {
  const max = Math.min(addOn.maxQuantity, addOn.availableCount);
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    // Stacked below `sm` for the same reason as GearCard's own price/stepper row above — this row
    // sits nested one level deeper (inside a selected card's "Optional Add-ons" list), so its
    // available width is narrower still; the name column previously had no `min-w-0` at all, so a
    // longer add-on name would force the row to overflow rather than wrap.
    <div className="flex flex-col items-start gap-2 rounded-xl bg-surface-muted p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3">
      <div className="min-w-0">
        <p className="break-words text-xs font-medium text-ink sm:text-sm">{cleanGearName(addOn.name)}</p>
        {productNote(addOn) && <p className="break-words text-[11px] font-medium leading-snug text-accent sm:text-xs">{productNote(addOn)}</p>}
        {/* Reuses the same "View Details" popup a gear kind gets — see addOnAsGearKind's own doc
            comment for why an add-on has no photo/free-accessories/nested-add-ons of its own. */}
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="text-[11px] font-medium text-accent underline underline-offset-2"
        >
          View Details
        </button>
        <p className="text-[11px] text-ink-muted sm:text-xs">
          {hasDuration && price !== null
            ? `${formatCurrency(price)} each`
            : addOn.pricing['48h'] === addOn.pricing['72h']
              ? `${formatCurrency(addOn.pricing['48h'])} each`
              : `${formatCurrency(addOn.pricing['48h'])}–${formatCurrency(addOn.pricing['72h'])} each`}
        </p>
        {showUpsell && getSeventyTwoHourUpsellDelta(addOn.pricing) > 0 && (
          <p className="hidden text-xs font-medium text-accent sm:block">
            Add {formatCurrency(getSeventyTwoHourUpsellDelta(addOn.pricing))} each to rent for 72h instead
          </p>
        )}
        {showExtraDayRate && addOn.extraPerDayPrice > 0 && (
          <p className="hidden text-xs font-medium text-ink-muted sm:block">
            +{formatCurrency(addOn.extraPerDayPrice)} each per extra day
          </p>
        )}
        {quantity > 1 && hasDuration && price !== null && (
          <p className="text-[11px] text-ink-muted sm:text-xs">Subtotal: {formatCurrency(price * quantity)}</p>
        )}
      </div>
      {max > 0 ? (
        // Below `sm` only: "Avail: N" (shorter label — this row is nested one level deeper than
        // GearCard's own, inside an already-narrow mobile card, and "Available:" alone overflowed
        // past the card edge) and the stepper share one line, with `compact` shrinking its buttons
        // to make room. `sm` and up reverts to the original stacked layout at full size — this was
        // never asked for beyond mobile, and desktop had room for it as it was.
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:flex-nowrap sm:flex-col sm:items-end sm:justify-start sm:gap-1">
          <span className="text-[11px] text-ink-faint sm:hidden">Avail: {max}</span>
          <span className="hidden text-xs text-ink-faint sm:block">Available: {max}</span>
          <QuantityStepper value={quantity} max={max} ariaLabel={addOn.name} onChange={onChange} compact />
        </div>
      ) : (
        <span className="text-xs font-medium text-ink-faint">Unavailable</span>
      )}
      {detailsOpen && (
        <GearDetailsDialog kind={addOnAsGearKind(addOn)} quantity={quantity} onQuantityChange={onChange} onClose={() => setDetailsOpen(false)} />
      )}
    </div>
  );
}

interface GearCardProps {
  kind: BookableGearKind;
  quantity: number;
  addOnSelections: BookableAddOnSelection[];
  tripDetails: TripDetails;
  hasDuration: boolean;
  showUpsell: boolean;
  /** Mirrors AddOnRow's own prop of the same name — see its doc comment. */
  showExtraDayRate: boolean;
  price: number | null;
  /** Set only when this selected kind came back in the RMS's availability issues for the current
   * dates — never inferred locally. */
  unavailableForDates: boolean;
  onQuantityChange: (next: number) => void;
  onAddOnQuantityChange: (addOn: BookableAddOn, next: number) => void;
}

function GearCard({
  kind,
  quantity,
  addOnSelections,
  tripDetails,
  hasDuration,
  showUpsell,
  showExtraDayRate,
  price,
  unavailableForDates,
  onQuantityChange,
  onAddOnQuantityChange,
}: GearCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const addOnQuantities = new Map(addOnSelections.map((a) => [`${a.category}|${a.brand}|${a.model ?? ''}`, a.quantity]));
  const isSelected = quantity > 0;
  const cardBestFor = splitBestForLine(kind.description ?? '');

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-surface shadow-sm transition-all hover:shadow-md ${
        isSelected ? 'border-brand-forest ring-1 ring-brand-forest/30' : 'border-line'
      }`}
    >
      {/* Edge-to-edge image with overlaid badges — free-accessory tag, stock state, and selected
       * quantity all sit on the image itself rather than competing with it for space below.
       * aspect-square at every width: this grid is 2 columns even at the narrowest mobile width
       * (see the grid below), so a card's own column is already only ~half the old single-column
       * width — the image needs no further breakpoint-specific ratio concession beyond a square
       * crop, which previously only kicked in from `sm` up. */}
      <div className="relative aspect-square w-full overflow-hidden bg-surface-strong">
        {imageFailed || !kind.imageUrl ? (
          <div className="flex h-full w-full items-center justify-center">
            <GearPlaceholderIcon className="h-10 w-10 text-ink-faint" />
          </div>
        ) : (
          // A real button (not a click handler on a bare <img>) for keyboard/assistive-tech
          // reachability — opens the shared ImageLightbox for a larger view. The overlaid
          // free-accessory/quantity badges below aren't inside this button, so they're unaffected;
          // the card's own quantity stepper/add button live further down, untouched.
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label={`View larger image of ${kind.name}`}
            className="h-full w-full"
          >
            <img
              src={kind.imageUrl}
              alt={kind.name}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        )}

        {kind.freeAccessories.length > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-brand-forest px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            🎁 Free use of {kind.freeAccessories.map((a) => a.name).join(' & ')}
          </span>
        )}

        {isSelected && (
          <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-forest px-1.5 text-xs font-bold text-white shadow-sm">
            {quantity}
          </span>
        )}

        {/* Explicitly black, never bg-ink: these are dimming scrims over a gear photo, so they must
            stay dark in BOTH themes. `ink` is the theme's TEXT colour and is pure white in Dark
            Mode, which would otherwise render this overlay white-on-white. */}
        {!kind.canSelect && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
            <span className="rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white">Out of Stock</span>
          </div>
        )}

        {kind.canSelect && unavailableForDates && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
            <span className="rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white">
              Unavailable for these dates
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint sm:text-[11px]">{kind.category}</p>
          {/* Real, RMS-sourced stock count (GET /api/customer/catalog/gear) — never a client-side
           * estimate. Shown even before the item is selected, matching the "Available: N" +
           * quantity control pairing requested for once it is. */}
          {kind.canSelect && (
            <span className="shrink-0 text-[10px] text-ink-faint sm:text-[11px]">Avail: {kind.availableCount}</span>
          )}
        </div>
        <h3 className="line-clamp-2 text-xs font-medium leading-snug text-ink sm:text-sm" title={cleanGearName(kind.name)}>
          {cleanGearName(kind.name)}
        </h3>
        {cardBestFor.bestFor ? (
          <p className="-mt-0.5 break-words text-[11px] font-medium leading-snug text-accent sm:text-xs">
            Best {cardBestFor.lead} {cardBestFor.bestFor}
          </p>
        ) : (
          productNote(kind) && (
            <p className="-mt-0.5 break-words text-[11px] font-medium leading-snug text-accent sm:text-xs">{productNote(kind)}</p>
          )
        )}
        {sizeCapacityToShow(kind) && (
          <p className="text-[11px] text-ink-muted sm:text-xs">Size/Capacity: {sizeCapacityToShow(kind)}</p>
        )}
        {/* Trial: opens the new details popup (gallery, description, FAQ) — see GearDetailsDialog's
            own doc comment. A plain text link, not styled as a button, so it reads as secondary to
            the card's own quantity control below. */}
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="self-start text-[11px] font-medium text-accent underline underline-offset-2 sm:text-xs"
        >
          View Details
        </button>

        {/* Stacked below `sm` so the QuantityStepper (a fixed ~136px: two h-9 buttons + a w-12
            input) gets the full width of the card instead of being squeezed beside the price —
            at 375px in this 2-column grid, a card's own content column is only ~146px, which left
            room for barely 2-3px of price text once a gear kind was actually selected. Side by
            side again once the card is wide enough — mirrors PathACatalog's own PackageAddOnsSection
            card, which already uses this exact pattern for the identical reason. */}
        {/* Below `sm` only: row (price left, control right) while unselected, same as `sm` and up
            always is — column only once selected, when the control becomes the full ~136px
            QuantityStepper (two buttons + an input) that a ~146px mobile card column genuinely has
            no room to sit beside (see that control's own comment). The plain round "+" button is
            small enough to share a row even at mobile width, which is what makes room to finally
            show the 72h-upsell/extra-day-rate hints below on mobile too — see those paragraphs'
            own `hidden` toggle. */}
        <div
          className={`mt-auto flex gap-1.5 pt-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2 sm:pt-2 ${
            isSelected ? 'flex-col items-start' : 'flex-row items-center justify-between'
          }`}
        >
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight text-accent sm:text-lg">
              {hasDuration && price !== null
                ? formatCurrency(price)
                : kind.pricing['48h'] === kind.pricing['72h']
                  ? formatCurrency(kind.pricing['48h'])
                  : `${formatCurrency(kind.pricing['48h'])}–${formatCurrency(kind.pricing['72h'])}`}
            </p>
            {showUpsell && getSeventyTwoHourUpsellDelta(kind.pricing) > 0 && (
              <p className={`text-[11px] font-medium text-accent sm:block ${isSelected ? 'hidden' : ''}`}>
                +{formatCurrency(getSeventyTwoHourUpsellDelta(kind.pricing))} for 72h
              </p>
            )}
            {showExtraDayRate && kind.extraPerDayPrice > 0 && (
              <p className={`text-[11px] font-medium text-ink-muted sm:block ${isSelected ? 'hidden' : ''}`}>
                +{formatCurrency(kind.extraPerDayPrice)} per extra day
              </p>
            )}
            {quantity > 1 && hasDuration && price !== null && (
              <p className="text-[10px] text-ink-muted sm:text-[11px]">Subtotal {formatCurrency(price * quantity)}</p>
            )}
          </div>

          {kind.canSelect ? (
            isSelected ? (
              // Always decreasable/removable regardless of a later availability re-check, same
              // principle as Path A's cards — a customer can never get stuck unable to remove a
              // selection that just went stale. Only increasing further is blocked while unavailable.
              <QuantityStepper
                value={quantity}
                max={unavailableForDates ? quantity : kind.availableCount}
                ariaLabel={kind.name}
                onChange={onQuantityChange}
              />
            ) : (
              // unavailableForDates is only ever computed for already-selected kinds (see the
              // availability effect below, which only checks cart.byoGears) — an unselected kind
              // reaching this branch is always still governed by the static canSelect snapshot.
              // h-9 w-9 from `sm` up, matching the QuantityStepper buttons this same control turns
              // into once quantity > 0. Below `sm` it's h-8 (32px) — smaller than that, but
              // deliberately NOT the h-7 (28px) an earlier compaction pass already tried and
              // reverted for being noticeably harder to hit accurately on a real phone; 32px is the
              // smallest step down that still makes room, on mobile, for the price row to sit
              // beside it instead of below it (see the row's own comment above).
              <button
                type="button"
                onClick={() => onQuantityChange(1)}
                aria-label={`Add ${kind.name} to cart`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-forest text-white shadow-sm transition-transform hover:bg-brand-forest-dark active:scale-90 sm:h-9 sm:w-9"
              >
                <PlusIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            )
          ) : (
            <span className="shrink-0 text-[11px] font-medium text-ink-faint sm:text-xs">Unavailable</span>
          )}
        </div>

        {isSelected && kind.compatibleAddOns.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1.5 border-t border-line-soft pt-1.5 sm:mt-2 sm:gap-2 sm:pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Optional Add-ons</p>
            {kind.compatibleAddOns.map((addOn) => {
              const key = `${addOn.category}|${addOn.brand}|${addOn.model ?? ''}`;
              return (
                <AddOnRow
                  key={key}
                  addOn={addOn}
                  quantity={addOnQuantities.get(key) ?? 0}
                  hasDuration={hasDuration}
                  price={hasDuration ? getGearKindPrice(addOn, tripDetails) : null}
                  showUpsell={showUpsell}
                  showExtraDayRate={showExtraDayRate}
                  onChange={(next) => onAddOnQuantityChange(addOn, next)}
                />
              );
            })}
          </div>
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
      {detailsOpen && (
        <GearDetailsDialog
          kind={kind}
          quantity={quantity}
          onQuantityChange={onQuantityChange}
          onClose={() => setDetailsOpen(false)}
          addOnsSection={{
            addOnQuantities,
            getPrice: (addOn) => (hasDuration ? getGearKindPrice(addOn, tripDetails) : null),
            hasDuration,
            showUpsell,
            showExtraDayRate,
            onAddOnQuantityChange,
          }}
        />
      )}
    </div>
  );
}

export default function PathBCatalog() {
  usePageMeta(PAGE_META.buildYourOwn.title, PAGE_META.buildYourOwn.description);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { gearKinds: catalogGearKinds, gearCatalogState, retryGearCatalog } = useCatalog();
  const gearKinds = useMemo(() => orderGearKinds(catalogGearKinds), [catalogGearKinds]);
  const { cart, totals, updateTripDetails, setByoGearQuantity, setByoAddOnQuantity } = useRental();
  // Restored from any already-saved dates (same reasoning as PathACatalog's own selectedDuration
  // state) so navigating away and back — or simply reloading — doesn't silently drop a duration
  // the customer already picked while `cart.tripDetails` itself already remembers it.
  const [selectedPreset, setSelectedPreset] = useState<ByoDuration | null>(() =>
    durationFromDates(cart.tripDetails.startDate, cart.tripDetails.returnDate),
  );
  // Whole days added on top of the 72h preset — see the "Want to rent longer?" control below,
  // identical in behavior to PathACatalog's own. Restored the same way selectedPreset is.
  const [extraDays, setExtraDays] = useState(() =>
    extraDaysFromDates(cart.tripDetails.startDate, cart.tripDetails.returnDate),
  );
  // The customer's own category pick; null until they pick one (see `activeCategory` below for the
  // default). There is no "All" view on this page.
  const [chosenCategory, setChosenCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPage, setItemsPage] = useState(1);
  // The one page-wide color the customer picked (Black/Khaki) — applies to every multi-color gear
  // kind shown, so it doesn't have to be chosen product by product. null = the default (see
  // `activeColor` below).
  const [chosenColor, setChosenColor] = useState<string | null>(null);
  const cartItemCount = cart.selectedKits.length + cart.selectedItems.length + cart.byoGears.length;
  const isUnlocked = totals.rentalDurationDays > 0;
  const hasDuration = calculateRentalDurationDays(cart.tripDetails) > 0;

  const gearSelections = useMemo(
    () => new Map(cart.byoGears.map((gear) => [byoGearKey(gear), gear.quantity])),
    [cart.byoGears],
  );

  // Real, date-scoped availability for whatever the customer has already selected — checked
  // against the RMS's actual inventory/assignment data, never computed locally, and never checked
  // for the whole catalog (only the customer's own cart selection, one batched request). Add-ons
  // are folded in the same way the RMS's own booking submission treats them: real inventory
  // consumption alongside the parent gear, not a separate concern. The actual debounce/abort/
  // retry/timeout lifecycle now lives in the shared useAvailabilityCheck hook — this only builds
  // the request object (or null, when there's nothing to check yet).
  const byoAvailabilityRequest: RmsAvailabilityRequest | null = useMemo(() => {
    if (!isUnlocked || cart.byoGears.length === 0) return null;
    // toAvailabilityTimestamp, not a hardcoded midnight literal — this runs before the customer
    // ever reaches Trip Details (falls back to midnight until Preferred Time has a real value),
    // but sends the exact same timestamp the final booking submission would once one exists.
    // dates are already known-valid here (isUnlocked requires totals.rentalDurationDays > 0), so
    // these can never actually be null.
    const pickupAt = toAvailabilityTimestamp(cart.tripDetails.startDate, cart.tripDetails.preferredTime)!;
    const returnAt = toAvailabilityTimestamp(cart.tripDetails.returnDate, cart.tripDetails.preferredTime)!;
    const bookingGears = cart.byoGears.map((g) => ({
      category: g.category,
      brand: toRmsBrand(g.brand),
      model: g.model,
      quantity: g.quantity,
      ...(g.color ? { color: g.color } : {}),
    }));
    const addOns = Object.values(cart.byoAddOns)
      .flat()
      .map((a) => ({ category: a.category, brand: toRmsBrand(a.brand), model: a.model, quantity: a.quantity }));
    return { pickupAt, returnAt, bookingGears, addOns };
  }, [isUnlocked, cart.tripDetails.startDate, cart.tripDetails.returnDate, cart.tripDetails.preferredTime, cart.byoGears, cart.byoAddOns]);

  const byoAvailabilityCheck = useAvailabilityCheck(byoAvailabilityRequest);
  // Preserves the exact pre-existing local shape every consumer below already reads
  // (RmsAvailabilityResult | 'checking' | 'error' | null) — no changes needed to
  // unavailableNames or any of the render/CTA logic further down. 'rate_limited' collapses into
  // the same 'error' this page has always shown: BYO never had a distinct rate-limited message,
  // and the shared hook's own coordinator already absorbs short rate-limit blips inline before
  // ever surfacing this state at all.
  const byoAvailability: RmsAvailabilityResult | 'checking' | 'error' | null =
    byoAvailabilityCheck.status === 'idle'
      ? null
      : byoAvailabilityCheck.status === 'checking'
        ? 'checking'
        : byoAvailabilityCheck.status === 'success'
          ? byoAvailabilityCheck.result ?? 'error'
          : 'error';

  const retryByoAvailability = byoAvailabilityCheck.retry;

  const unavailableNames = useMemo(() => {
    // 'error' has no issues list to draw from (the RMS never actually answered) — never treated as
    // "nothing is unavailable," just as "nothing SPECIFIC can be named yet." The bottom CTA below
    // still blocks on 'error' independently of this set, so a stale "everything looks fine" per-item
    // badge state is never the only thing standing between the customer and checking out.
    if (!byoAvailability || byoAvailability === 'checking' || byoAvailability === 'error' || byoAvailability.available) {
      return new Set<string>();
    }
    return new Set(byoAvailability.issues.map((i) => i.name));
  }, [byoAvailability]);

  const categories = useMemo(() => Array.from(new Set(gearKinds.map((kind) => kind.category))), [gearKinds]);
  // Opens on Tent (the first category, since tents are listed first) unless the customer picked
  // another one — falls back to whatever category exists first if there are no tents.
  const activeCategory =
    chosenCategory && categories.includes(chosenCategory)
      ? chosenCategory
      : (categories.find((category) => category.toLowerCase() === 'tent') ?? categories[0] ?? '');

  const normalizedSearch = searchQuery.trim().toLowerCase();
  // With no "All" pill, a search looks across every category (otherwise a search for "chair" while
  // Tent is showing would find nothing); with no search, the active category is what's shown.
  const filteredKinds = normalizedSearch
    ? gearKinds.filter((kind) =>
        [kind.name, kind.brand, kind.category].some((field) => field.toLowerCase().includes(normalizedSearch)),
      )
    : gearKinds.filter((kind) => kind.category === activeCategory);

  // The colors offered by whatever is on screen right now (Tent, Bed, Table, Chair...) — the switch
  // only appears when at least two exist, so categories without color options show no switch.
  // Only Tent/Bed/Table/Chair take part (see supportsColorFilter) — other categories, such as Other
  // Gear Essentials, never contribute a color option and are never filtered by it.
  const colorOptions = useMemo(() => gearColorOptions(filteredKinds.filter(supportsColorFilter)), [filteredKinds]);
  const activeColor =
    colorOptions.length > 1
      ? chosenColor && colorOptions.includes(chosenColor)
        ? chosenColor
        : colorOptions[0]
      : undefined;
  // Strict: only gear that really comes in the chosen color. Gear whose color the RMS doesn't
  // report at all is kept (see filterGearByColor).
  const displayKinds = activeColor
    ? filteredKinds.filter((kind) => !supportsColorFilter(kind) || filterGearByColor([kind], activeColor).length > 0)
    : filteredKinds;

  // Whenever the visible set changes shape (a new search or category), the old page number no
  // longer means the same thing — back to page 1 rather than risk landing on a page past the end.
  useEffect(() => {
    setItemsPage(1);
  }, [activeCategory, normalizedSearch, activeColor]);

  const itemsPageCount = Math.max(1, Math.ceil(displayKinds.length / ITEMS_PAGE_SIZE));
  const paginatedKinds = displayKinds.slice(
    (itemsPage - 1) * ITEMS_PAGE_SIZE,
    itemsPage * ITEMS_PAGE_SIZE,
  );

  // A guest can browse and configure Build Your Own gear freely, but actually adding it to the
  // cart requires an account — RentalContext's setByoGearQuantity/setByoAddOnQuantity already
  // refuse the mutation itself while signed out (the real backstop), so this is only the friendly
  // redirect layer: send them to Login with a reason, rather than a "+" button doing nothing.
  function requireAuth(): boolean {
    if (user) return true;
    navigate('/login', {
      state: {
        from: location.pathname,
        mode: 'login',
        reason: 'Please log in or create an account to add gear to your cart.',
      },
    });
    return false;
  }

  // Mirrors PathACatalog's own handleDurationSelect exactly: extra days only ever stack on top of
  // 72h, so switching to 48h always clears them rather than letting a previously-chosen "+2 extra
  // days" silently reappear once 72h is picked again.
  function handleDurationSelect(preset: ByoDuration) {
    setSelectedPreset(preset);
    const nextExtraDays = preset === '72h' ? extraDays : 0;
    setExtraDays(nextExtraDays);
    // TODAY (the customer's local day), not getDurationRange's own default — that default is the
    // UTC day, which would seed a start date below this field's own `min` for the first 8 hours of
    // every Philippine day. Same reasoning as PathACatalog's own handleDurationSelect.
    updateTripDetails(getDurationRange(preset, cart.tripDetails.startDate || TODAY, nextExtraDays));
  }

  // Mirrors PathACatalog's own handleStartDateChange exactly.
  function handleStartDateChange(value: string) {
    if (!selectedPreset) return;
    // A date input can be cleared to '' (and a partially-typed date reads as invalid), which
    // getDurationRange would turn into an Invalid Date and throw on — clearing the field just
    // clears both dates instead, which the rest of this page already treats as "no duration yet"
    // (see isUnlocked/hasDuration above).
    if (!value || Number.isNaN(new Date(value).getTime())) {
      updateTripDetails({ startDate: '', returnDate: '' });
      return;
    }
    updateTripDetails(getDurationRange(selectedPreset, value, extraDays));
  }

  /** Only reachable while `selectedPreset === '72h'` (see the control itself) — clamped to never
   *  go negative, since there's no "-1 extra day" concept. Mirrors PathACatalog's own
   *  handleExtraDaysChange exactly. */
  function handleExtraDaysChange(next: number) {
    const clamped = Math.max(0, next);
    setExtraDays(clamped);
    updateTripDetails(getDurationRange('72h', cart.tripDetails.startDate || TODAY, clamped));
  }

  return (
    // pb-56 — see Cart.tsx's identical comment: this route's lifted floating buttons reach up to
    // ~208px above the viewport bottom, more than pb-28 (112px) cleared.
    <div className="flex min-h-screen flex-col pb-56">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-4 sm:gap-6 sm:p-6">
        <BackLink to="/catalog" label="Back to Browse Gear" />
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-lg font-semibold text-ink sm:text-xl">Build Your Own</h1>
          <p className="text-sm text-ink-muted">Pick your rental duration first, then mix and match individual gear.</p>
          <p className="text-xs text-ink-faint">
            Prices shown are estimates from our live catalog, GearBnB confirms final rates when your booking
            is submitted.{' '}
            <Link to="/terms" className="font-medium text-accent underline underline-offset-2">
              View Terms &amp; Conditions
            </Link>
          </p>
        </div>

        <div
          id="byo-duration-picker"
          className="flex flex-col space-y-3 rounded-2xl border border-line/80 bg-surface-muted/60 p-3 shadow-sm sm:space-y-6 sm:p-6 md:p-8"
        >
          <div>
            <span className={CONTROL_LABEL_CLASS}>Rental Duration</span>
            {/* Duration pills and the extra-day stepper share one flex-wrap row so they read as
                one control group — identical structure to PathACatalog's own Rental Duration row. */}
            <div className="flex flex-wrap items-center gap-3">
              {BYO_DURATION_PRESETS.map((preset) => (
                <FilterPill key={preset.id} selected={selectedPreset === preset.id} onClick={() => handleDurationSelect(preset.id)}>
                  {preset.label}
                  {DURATION_PROMO_BADGES[preset.id] && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        selectedPreset === preset.id ? 'bg-white/20 text-white' : 'bg-brand-forest/10 text-accent'
                      }`}
                    >
                      {DURATION_PROMO_BADGES[preset.id]}
                    </span>
                  )}
                </FilterPill>
              ))}

              {/* Subtle, additive control — the 48h/72h pills above are untouched, exactly as
                  before. Only appears once 72h is actually selected, since extra days only ever
                  stack on top of that tier (48h has no "beyond" concept here). Replaces the old
                  free-form "Custom / Extra Days" date pair: that let a customer pick any arbitrary
                  date range, which is a duration this page's own pricing (getGearKindPrice's tiered
                  48h/72h+extra-day formula) was never designed to be chosen outside of — this
                  control reaches the same "rent longer than 72h" outcome without inventing a new
                  duration value, identical to PathACatalog's own "Want to rent longer?" control. */}
              {selectedPreset === '72h' && (
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

          {/* Both dates read from (and write back to) the shared cart trip details — same as
              PathACatalog's identical Rental Dates section. */}
          <div>
            <span className={CONTROL_LABEL_CLASS}>Rental Dates</span>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Start Date</span>
                <input
                  type="date"
                  value={cart.tripDetails.startDate}
                  min={TODAY}
                  disabled={!selectedPreset}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className={`${DATE_FIELD_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                />
              </label>
              {/* Read-only by design, never a free-form input — identical reasoning to
                  PathACatalog's own End Date field: the end date is fully determined by the chosen
                  duration, so letting it be typed freely would produce rental periods this page's
                  own tiered pricing can't price, and would make an invalid range (end before start)
                  possible instead of structurally impossible. */}
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">End Date</span>
                <input
                  type="date"
                  value={cart.tripDetails.returnDate}
                  readOnly
                  disabled
                  className={`${DATE_FIELD_CLASS} cursor-not-allowed`}
                />
              </label>
            </div>
            <p className={HELPER_TEXT_CLASS}>
              {selectedPreset
                ? `Your end date is set automatically from the ${
                    BYO_DURATION_PRESETS.find((preset) => preset.id === selectedPreset)?.label ?? 'selected'
                  } rental duration${extraDays > 0 ? ` plus ${extraDays} extra day${extraDays > 1 ? 's' : ''}` : ''} above.`
                : 'Select a rental duration above to choose your rental dates.'}
            </p>
          </div>
        </div>

        {isUnlocked && byoAvailability === 'checking' && (
          <p className="text-xs text-ink-faint" aria-busy>
            Checking availability for your selected gear…
          </p>
        )}
        {isUnlocked && byoAvailability === 'error' && (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-500/30 dark:bg-red-500/10">
            <p className="font-semibold text-red-700 dark:text-red-400">Couldn't check availability</p>
            <p className="text-red-700/90 dark:text-red-400/90">
              We couldn't verify your selected gear's availability just now. Please try again before checking out.
            </p>
            <button
              type="button"
              onClick={retryByoAvailability}
              className="rounded-lg border border-red-300 bg-surface px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Try again
            </button>
          </div>
        )}
        {isUnlocked && byoAvailability && byoAvailability !== 'checking' && byoAvailability !== 'error' && !byoAvailability.available && (
          <div className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-400/30 dark:bg-amber-400/10">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Some of your selected gear isn't available for these dates
            </p>
            <p className="text-amber-800/90 dark:text-amber-300/90">
              {byoAvailability.issues.map((issue) => cleanGearName(issue.name, { keepColor: true })).join(', ')}, adjust the quantity, remove it, or
              change your dates before checking out.
            </p>
          </div>
        )}

        {/* A genuine catalog failure is shown here, always at full visibility — never nested
         * inside the duration-gate's dimmed/opacity-40 wrapper below, where it would be faded
         * twice over (once by that wrapper, once more by the "select duration" overlay sitting on
         * top of it) into something a customer could easily miss entirely. */}
        {gearCatalogState === 'error' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
            <p className="text-sm text-red-600 dark:text-red-400">
              We couldn't load the Build Your Own catalog right now. Please try again shortly.
            </p>
            <button
              type="button"
              onClick={retryGearCatalog}
              className="rounded-lg border border-red-300 bg-surface px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Try Again
            </button>
          </div>
        )}

        {gearCatalogState !== 'error' && (
        <div className="relative flex flex-col gap-6">
          {!isUnlocked && (
            <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-surface/80 pt-16 backdrop-blur-sm">
              <p className="rounded-full bg-gray-900/90 px-4 py-2 text-sm font-medium text-white">
                Select your rental duration above to browse gear
              </p>
            </div>
          )}

          <div className={!isUnlocked ? 'pointer-events-none opacity-40' : undefined}>
            {gearCatalogState === 'loading' && (
              <div className="grid grid-cols-2 animate-pulse gap-2.5 sm:gap-4 lg:grid-cols-3" aria-busy="true" aria-label="Loading gear catalog">
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

            {gearCatalogState === 'ready' && gearKinds.length === 0 && (
              <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
                No gear is available for Build Your Own right now, check back soon!
              </p>
            )}

            {gearCatalogState === 'ready' && gearKinds.length > 0 && (
              <div className="flex flex-col gap-5">
                <label className="group relative block">
                  <span className="sr-only">Search gear</span>
                  <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-accent" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search gear by name, brand, or category…"
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

                {/* One swipeable row on phones — same pattern as PackageAddOnsSection's category
                    filter: wrapping many category chips into a block of buttons would consume far
                    more vertical space than the products it filters. Bleeds to the page's own
                    edges (-mx-4/px-4 match the outer container's mobile padding) so chips scroll
                    off-screen cleanly. From `sm` up there's room, so it wraps normally. */}
                <div
                  role="group"
                  aria-label="Filter gear by category"
                  // Same fade as PathACatalog's own add-on category row — both edges, since the
                  // left one cuts the same way once the row's been scrolled right.
                  className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,transparent_0%,black_8%,black_92%,transparent_100%)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 sm:[mask-image:none]"
                >
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setChosenCategory(category);
                        setSearchQuery('');
                      }}
                      className={`h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors sm:h-9 sm:px-4 sm:text-sm ${
                        !normalizedSearch && activeCategory === category
                          ? 'bg-brand-forest text-white'
                          : 'bg-surface-strong text-ink-muted hover:bg-line'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {/* One color switch for the whole page (shown only where the current category has
                    multi-color gear — Tent, Bed, Table, Chair) instead of a switch on every product. */}
                {activeColor && <ColorSwitch colors={colorOptions} active={activeColor} onChange={setChosenColor} />}

                {displayKinds.length === 0 ? (
                  <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
                    No gear matches "{searchQuery.trim()}". Try a different search or category.
                  </p>
                ) : (
                  <>
                    {/* grid-cols-2 below sm (not stacked to 1) — same reasoning as Path A's package
                        grid: a mobile catalog should show several gear cards per viewport. */}
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
                      {paginatedKinds.map((baseKind) => {
                        // `kind` is the page-wide color resolved to that color's own image, stock,
                        // price and name — and its own cart identity. Single-color gear passes
                        // through unchanged.
                        const kind = resolveGearVariant(baseKind, supportsColorFilter(baseKind) ? activeColor : undefined);
                        const key = byoGearKey(kind);
                        return (
                          <GearCard
                            key={key}
                            kind={kind}
                            quantity={gearSelections.get(key) ?? 0}
                            addOnSelections={cart.byoAddOns[key] ?? []}
                            tripDetails={cart.tripDetails}
                            hasDuration={hasDuration}
                            showUpsell={selectedPreset === '48h'}
                            showExtraDayRate={selectedPreset === '72h'}
                            price={hasDuration ? getGearKindPrice(kind, cart.tripDetails) : null}
                            unavailableForDates={unavailableNames.has(kindDisplayName(kind))}
                            onQuantityChange={(next) => {
                              const current = gearSelections.get(key) ?? 0;
                              if (next > current && !requireAuth()) return;
                              setByoGearQuantity(kind, next);
                            }}
                            onAddOnQuantityChange={(addOn, next) => {
                              const current =
                                (cart.byoAddOns[key] ?? []).find((a) => byoGearKey(a) === byoGearKey(addOn))?.quantity ?? 0;
                              if (next > current && !requireAuth()) return;
                              setByoAddOnQuantity(key, addOn, next);
                            }}
                          />
                        );
                      })}
                    </div>

                    {itemsPageCount > 1 && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setItemsPage((page) => Math.max(1, page - 1))}
                          disabled={itemsPage === 1}
                          aria-label="Previous page"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronIcon direction="left" className="h-4 w-4" />
                        </button>
                        {Array.from({ length: itemsPageCount }, (_, index) => index + 1).map((pageNumber) => (
                          <button
                            key={pageNumber}
                            type="button"
                            onClick={() => setItemsPage(pageNumber)}
                            aria-current={itemsPage === pageNumber ? 'page' : undefined}
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                              itemsPage === pageNumber
                                ? 'bg-brand-forest text-white'
                                : 'text-ink-muted hover:bg-surface-strong'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setItemsPage((page) => Math.min(itemsPageCount, page + 1))}
                          disabled={itemsPage === itemsPageCount}
                          aria-label="Next page"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronIcon direction="right" className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              {cartItemCount} item{cartItemCount === 1 ? '' : 's'} selected
              {isUnlocked && (
                <span className="ml-1.5 text-ink-faint">
                  &bull; {totals.rentalDurationDays}-day rental
                </span>
              )}
            </span>
            <span className="text-sm font-semibold text-ink">
              {cart.byoGears.length > 0 && cart.selectedKits.length === 0 ? (
                <>Deposit: To be determined by GearBnB</>
              ) : (
                <>Deposit {formatCurrency(totals.dueToday)}</>
              )}
              <span className="mx-1.5 text-ink-faint">&bull;</span>
              Rental Fee {formatCurrency(totals.dueBeforeStart)}
            </span>
          </div>
          {byoAvailability === 'error' ? (
            // A failed check is never treated as "nothing to block on" — same reasoning as
            // unavailableNames above: the RMS never actually confirmed this selection is bookable,
            // so this blocks exactly like a real unavailable result would, not like the "not yet
            // checked" null state.
            <span
              className="cursor-not-allowed rounded-lg bg-surface-strong px-5 py-2.5 text-sm font-semibold text-ink-faint"
              title="We couldn't verify availability, try again above before checking out"
            >
              Couldn't check availability
            </span>
          ) : byoAvailability !== 'checking' && byoAvailability && !byoAvailability.available ? (
            <span
              className="cursor-not-allowed rounded-lg bg-surface-strong px-5 py-2.5 text-sm font-semibold text-ink-faint"
              title="Adjust or remove the unavailable gear above before checking out"
            >
              Resolve unavailable gear first
            </span>
          ) : (
            <Link
              to="/cart"
              className="rounded-lg bg-brand-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
            >
              Go to Cart &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
