import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BackLink from '../components/BackLink';
import { ChevronIcon, GearPlaceholderIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import {
  byoGearKey,
  calculateRentalDurationDays,
  getGearKindPrice,
  useRental,
} from '../context/RentalContext';
import type { BookableAddOn, BookableAddOnSelection, BookableGearKind, DurationPresetId, TripDetails } from '../types/gearbnb';
import { DURATION_PRESETS, DURATION_PROMO_BADGES, getDurationRange, getSeventyTwoHourUpsellDelta } from '../utils/duration';
import { formatCurrency } from '../utils/format';
import { checkAvailability, type RmsAvailabilityResult } from '../utils/rmsApi';

/** Mirrors the RMS's own customer-safe display-name construction
 * (src/server/availability/service.ts's kindDisplayName) exactly, so an
 * issue's `name` can be matched back to the gear card it's about. `kind.brand`
 * arriving from GET /api/customer/catalog/gear is already "Generic"-stripped
 * server-side, so no additional cleaning is needed here. */
function kindDisplayName(kind: { category: string; brand: string; model: string | null }): string {
  const parts = [kind.brand, kind.model].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : kind.category;
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
const DATE_FIELD_CLASS =
  'h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';

export interface QuantityStepperProps {
  value: number;
  max: number;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (next: number) => void;
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
export function QuantityStepper({ value, max, disabled, ariaLabel, onChange }: QuantityStepperProps) {
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
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
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
          className="w-12 rounded-md border border-line bg-surface py-1 text-center text-sm font-semibold text-ink outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${ariaLabel}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40"
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
  onChange: (next: number) => void;
}

function AddOnRow({ addOn, quantity, hasDuration, price, showUpsell, onChange }: AddOnRowProps) {
  const max = Math.min(addOn.maxQuantity, addOn.availableCount);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted p-3">
      <div>
        <p className="text-sm font-medium text-ink">{addOn.name}</p>
        <p className="text-xs text-ink-muted">
          {hasDuration && price !== null
            ? `${formatCurrency(price)} each`
            : `${formatCurrency(addOn.pricing['48h'])}–${formatCurrency(addOn.pricing['72h'])} each`}
        </p>
        {showUpsell && (
          <p className="text-xs font-medium text-accent">
            Add {formatCurrency(getSeventyTwoHourUpsellDelta(addOn.pricing))} each to rent for 72h instead
          </p>
        )}
        {quantity > 1 && hasDuration && price !== null && (
          <p className="text-xs text-ink-muted">Subtotal: {formatCurrency(price * quantity)}</p>
        )}
      </div>
      {max > 0 ? (
        <div className="flex flex-col items-end gap-1">
          <span className="text-[11px] text-ink-faint">Available: {max}</span>
          <QuantityStepper value={quantity} max={max} ariaLabel={addOn.name} onChange={onChange} />
        </div>
      ) : (
        <span className="text-xs font-medium text-ink-faint">Unavailable</span>
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
  price,
  unavailableForDates,
  onQuantityChange,
  onAddOnQuantityChange,
}: GearCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const addOnQuantities = new Map(addOnSelections.map((a) => [`${a.category}|${a.brand}|${a.model ?? ''}`, a.quantity]));
  const isSelected = quantity > 0;

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-surface shadow-sm transition-all hover:shadow-md ${
        isSelected ? 'border-brand-forest ring-1 ring-brand-forest/30' : 'border-line'
      }`}
    >
      {/* Edge-to-edge image with overlaid badges — free-accessory tag, stock state, and selected
       * quantity all sit on the image itself rather than competing with it for space below. */}
      <div className="relative aspect-square w-full overflow-hidden bg-surface-strong">
        {imageFailed || !kind.imageUrl ? (
          <div className="flex h-full w-full items-center justify-center">
            <GearPlaceholderIcon className="h-10 w-10 text-ink-faint" />
          </div>
        ) : (
          <img
            src={kind.imageUrl}
            alt={kind.name}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}

        {kind.freeAccessories.length > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-brand-forest px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            🎁 Free {kind.freeAccessories.map((a) => a.name).join(' & ')}
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

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{kind.category}</p>
          {/* Real, RMS-sourced stock count (GET /api/customer/catalog/gear) — never a client-side
           * estimate. Shown even before the item is selected, matching the "Available: N" +
           * quantity control pairing requested for once it is. */}
          {kind.canSelect && (
            <span className="shrink-0 text-[11px] text-ink-faint">Available: {kind.availableCount}</span>
          )}
        </div>
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink" title={kind.name}>
          {kind.name}
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-accent">
              {hasDuration && price !== null
                ? formatCurrency(price)
                : `${formatCurrency(kind.pricing['48h'])}–${formatCurrency(kind.pricing['72h'])}`}
            </p>
            {showUpsell && (
              <p className="text-[11px] font-medium text-accent">
                +{formatCurrency(getSeventyTwoHourUpsellDelta(kind.pricing))} for 72h
              </p>
            )}
            {quantity > 1 && hasDuration && price !== null && (
              <p className="text-[11px] text-ink-muted">Subtotal {formatCurrency(price * quantity)}</p>
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
              <button
                type="button"
                onClick={() => onQuantityChange(1)}
                aria-label={`Add ${kind.name} to cart`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-forest text-white shadow-sm transition-transform hover:bg-brand-forest-dark active:scale-90"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            )
          ) : (
            <span className="shrink-0 text-xs font-medium text-ink-faint">Unavailable</span>
          )}
        </div>

        {isSelected && kind.compatibleAddOns.length > 0 && (
          <div className="mt-2 flex flex-col gap-2 border-t border-line-soft pt-2">
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
                  onChange={(next) => onAddOnQuantityChange(addOn, next)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PathBCatalog() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { gearKinds, gearCatalogState, retryGearCatalog } = useCatalog();
  const { cart, totals, updateTripDetails, setByoGearQuantity, setByoAddOnQuantity } = useRental();
  const [selectedPreset, setSelectedPreset] = useState<ByoDuration | 'custom' | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPage, setItemsPage] = useState(1);
  const [byoAvailability, setByoAvailability] = useState<RmsAvailabilityResult | 'checking' | null>(null);

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
  // consumption alongside the parent gear, not a separate concern.
  useEffect(() => {
    if (!isUnlocked || cart.byoGears.length === 0) {
      setByoAvailability(null);
      return;
    }
    let cancelled = false;
    setByoAvailability('checking');
    const timer = setTimeout(() => {
      const bookingGears = cart.byoGears.map((g) => ({ category: g.category, brand: g.brand, model: g.model, quantity: g.quantity }));
      const addOns = Object.values(cart.byoAddOns)
        .flat()
        .map((a) => ({ category: a.category, brand: a.brand, model: a.model, quantity: a.quantity }));
      checkAvailability({
        pickupAt: new Date(`${cart.tripDetails.startDate}T00:00:00`).toISOString(),
        returnAt: new Date(`${cart.tripDetails.returnDate}T00:00:00`).toISOString(),
        bookingGears,
        addOns,
      })
        .then((result) => {
          if (!cancelled) setByoAvailability(result);
        })
        .catch(() => {
          if (!cancelled) setByoAvailability(null);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // cart.byoGears / cart.byoAddOns are new array/object references on every relevant change
    // (RentalContext's reducer never mutates in place), so re-running whenever their identity
    // changes is exactly "whenever the selection or dates change," nothing more.
  }, [isUnlocked, cart.tripDetails.startDate, cart.tripDetails.returnDate, cart.byoGears, cart.byoAddOns]);

  const unavailableNames = useMemo(() => {
    if (!byoAvailability || byoAvailability === 'checking' || byoAvailability.available) return new Set<string>();
    return new Set(byoAvailability.issues.map((i) => i.name));
  }, [byoAvailability]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(gearKinds.map((kind) => kind.category)));
    return ['All', ...unique];
  }, [gearKinds]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const categoryFilteredKinds =
    activeCategory === 'All' ? gearKinds : gearKinds.filter((kind) => kind.category === activeCategory);
  const filteredKinds = normalizedSearch
    ? categoryFilteredKinds.filter((kind) =>
        [kind.name, kind.brand, kind.category].some((field) => field.toLowerCase().includes(normalizedSearch)),
      )
    : categoryFilteredKinds;

  // Whenever the visible set changes shape (a new search or category), the old page number no
  // longer means the same thing — back to page 1 rather than risk landing on a page past the end.
  useEffect(() => {
    setItemsPage(1);
  }, [activeCategory, normalizedSearch]);

  const itemsPageCount = Math.max(1, Math.ceil(filteredKinds.length / ITEMS_PAGE_SIZE));
  const paginatedKinds = filteredKinds.slice(
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

  function handlePresetSelect(preset: ByoDuration) {
    setSelectedPreset(preset);
    updateTripDetails(getDurationRange(preset));
  }

  function handleCustomToggle() {
    setSelectedPreset('custom');
  }

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-5 sm:p-6">
        <BackLink to="/catalog" label="Back to Browse Gear" />
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-xl font-semibold text-ink">Build Your Own</h1>
          <p className="text-sm text-ink-muted">Pick your rental duration first, then mix and match individual gear.</p>
          <p className="text-xs text-ink-faint">
            Prices shown are estimates from our live catalog — GearBnB confirms final rates when your booking
            is submitted.{' '}
            <Link to="/terms" className="font-medium text-accent underline underline-offset-2">
              View Terms &amp; Conditions
            </Link>
          </p>
        </div>

        <div
          id="byo-duration-picker"
          className="flex flex-col space-y-6 rounded-2xl border border-line/80 bg-surface-muted/60 p-6 shadow-sm md:p-8"
        >
          <div>
            <span className={CONTROL_LABEL_CLASS}>Rental Duration</span>
            <div className="flex flex-wrap items-center gap-3">
              {BYO_DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    selectedPreset === preset.id
                      ? 'bg-brand-forest text-white'
                      : 'bg-surface text-ink-muted hover:bg-surface-strong'
                  }`}
                >
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
                </button>
              ))}
              <button
                type="button"
                onClick={handleCustomToggle}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedPreset === 'custom' ? 'bg-brand-forest text-white' : 'bg-surface text-ink-muted hover:bg-surface-strong'
                }`}
              >
                Custom / Extra Days
              </button>
            </div>
          </div>

          {selectedPreset === 'custom' && (
            <div>
              <span className={CONTROL_LABEL_CLASS}>Custom Rental Dates</span>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">Start Date</span>
                  <input
                    type="date"
                    value={cart.tripDetails.startDate}
                    onChange={(e) => updateTripDetails({ startDate: e.target.value })}
                    className={DATE_FIELD_CLASS}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">End Date</span>
                  <input
                    type="date"
                    value={cart.tripDetails.returnDate}
                    min={cart.tripDetails.startDate}
                    onChange={(e) => updateTripDetails({ returnDate: e.target.value })}
                    className={DATE_FIELD_CLASS}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {isUnlocked && byoAvailability === 'checking' && (
          <p className="text-xs text-ink-faint" aria-busy>
            Checking availability for your selected gear…
          </p>
        )}
        {isUnlocked && byoAvailability && byoAvailability !== 'checking' && !byoAvailability.available && (
          <div className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-400/30 dark:bg-amber-400/10">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Some of your selected gear isn't available for these dates
            </p>
            <p className="text-amber-800/90 dark:text-amber-300/90">
              {byoAvailability.issues.map((issue) => issue.name).join(', ')} — adjust the quantity, remove it, or
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
              <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading gear catalog">
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
                No gear is available for Build Your Own right now — check back soon!
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

                <div className="flex flex-wrap items-center gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
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

                {filteredKinds.length === 0 ? (
                  <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
                    No gear matches "{searchQuery.trim()}"{activeCategory !== 'All' ? ` in ${activeCategory}` : ''}.
                    Try a different search or category.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {paginatedKinds.map((kind) => {
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
          {byoAvailability !== 'checking' && byoAvailability && !byoAvailability.available ? (
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
