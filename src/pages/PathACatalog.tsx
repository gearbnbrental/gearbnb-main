import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MESSENGER_URL } from '../config/social';
import { ArrowRightIcon, CampfireIcon, GearPlaceholderIcon } from '../components/icons';
import BackLink from '../components/BackLink';
import PackageContents from '../components/PackageContents';
import SocialIconLink from '../components/SocialIconLink';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { useRental } from '../context/RentalContext';
import type { DateRange, DurationPresetId, PackageKit } from '../types/gearbnb';
import { DURATION_PRESETS, DURATION_PROMO_BADGES, getDurationRange, getSeventyTwoHourUpsellDelta } from '../utils/duration';
import { formatCurrency } from '../utils/format';
import { checkAvailability, type RmsAvailabilityIssue } from '../utils/rmsApi';

type PackageDuration = Extract<DurationPresetId, '48h' | '72h'>;

const PACKAGE_DURATION_PRESETS = DURATION_PRESETS.filter(
  (preset): preset is { id: PackageDuration; label: string; days: number } => preset.id !== '24h',
);

/**
 * Earliest selectable rental start, as the customer's OWN calendar day. Deliberately not
 * `new Date().toISOString().slice(0,10)`: that is the UTC day, which in the Philippines (UTC+8)
 * is still yesterday for the first 8 hours of every local day — as a `min` that would quietly
 * let a customer pick a start date already in the past.
 */
function localTodayISO(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const TODAY = localTodayISO();

/** One shared label style for every control group in the filter card (Group Size, Rental Duration,
 *  Rental Dates) — they previously each carried their own copy, which is how they drifted out of
 *  alignment with one another. */
const CONTROL_LABEL_CLASS = 'mb-2 block text-[11px] font-bold uppercase tracking-wider text-ink-muted';
const HELPER_TEXT_CLASS = 'mt-1.5 text-xs text-ink-faint';
const DATE_FIELD_CLASS =
  'h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';

/**
 * The single selectable-option control shared by Group Size and Rental Duration. Both rows used to
 * hand-roll their own pill with different padding (px-3 py-1 vs px-4 py-1.5), which is what made
 * the two rows look misaligned sitting one above the other. One component means one size, one
 * selected state, and one focus ring for both.
 *
 * `h-9` gives every pill the same height whether or not it also carries a promo badge, and keeps
 * the tap target comfortable on mobile. `aria-pressed` is what actually communicates the selected
 * state to a screen reader — colour alone never does.
 */
function FilterPill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/40 ${
        selected
          ? 'bg-brand-forest text-white shadow-sm'
          : 'border border-line bg-surface text-ink-muted hover:bg-surface-strong hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/** Which duration preset a saved start/return pair represents, or null if it matches none.
 *  Restores the picker's selection when a customer returns to this page with dates already in
 *  their cart — the dates persist in shared state, so the duration shown above them must too,
 *  rather than resetting to "select a duration" while populated dates sit below it. */
function durationFromDates(startDate: string, returnDate: string): PackageDuration | null {
  if (!startDate || !returnDate) return null;
  const start = new Date(startDate);
  const end = new Date(returnDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  // Anything past the 72h preset's 3 days is still "72h" plus extra days on top (see
  // extraDaysFromDates) — never a preset of its own.
  if (days > 3) return '72h';
  return PACKAGE_DURATION_PRESETS.find((preset) => preset.days === days)?.id ?? null;
}

/** Same idea as durationFromDates, but for the "want to rent longer?" extra-days count that sits
 *  on top of the 72h preset — a saved N-day range (N > 3) restores as 72h + (N-3) extra days
 *  instead of matching no preset at all and losing the customer's selection on return. Returns 0
 *  for anything that isn't a 72h-or-longer range (48h has no extra-days concept). */
function extraDaysFromDates(startDate: string, returnDate: string): number {
  if (!startDate || !returnDate) return 0;
  const start = new Date(startDate);
  const end = new Date(returnDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return days > 3 ? days - 3 : 0;
}

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

interface PackageCardProps {
  kit: PackageKit;
  dateRange: DateRange | null;
  selectedDuration: PackageDuration | null;
}

/** RMS-confirmed availability for whichever specific package (edition included) this card
 * currently represents. Deliberately never defaults to "available" while unconfirmed — 'idle'
 * (no dates yet) and 'checking' both render as neither available nor unavailable, so the UI can
 * never show a false in-stock state before the RMS has actually answered. */
type RmsAvailabilityState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'unavailable'; issues: RmsAvailabilityIssue[] }
  | { status: 'error' };

function PackageCard({ kit, dateRange, selectedDuration }: PackageCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, addKit, removeKit, addKitExtra, removeKitExtra } = useRental();
  const [selectedEditionId, setSelectedEditionId] = useState(kit.editions?.[0]?.id);
  const [imageFailed, setImageFailed] = useState(false);
  const [availability, setAvailability] = useState<RmsAvailabilityState>({ status: 'idle' });

  // The specific edition chosen (if any) becomes the cart item's real identity — this is what
  // gets submitted as the booking's package_id, so "Khaki" must never silently save as "Black".
  const selectedEdition = kit.editions?.find((edition) => edition.id === selectedEditionId);
  const effectiveId = selectedEdition?.id ?? kit.id;
  // The RMS's own Package.packageNumber for whichever edition is actually selected — never the
  // Supabase row id — matching exactly what booking submission would send for this same selection.
  const effectivePackageCode = selectedEdition?.packageNumber ?? kit.packageNumber;
  const isSelected = cart.selectedKits.some((selected) => selected.id === effectiveId);
  const selectedExtraIds = cart.kitExtras[effectiveId] ?? [];

  const displayImage = selectedEdition?.imageUrl || kit.imageUrl;
  const price = selectedDuration ? kit.pricing[selectedDuration] : null;

  // Real, date-scoped availability — checked against the RMS's actual inventory/assignment data,
  // never computed locally. Re-runs whenever the requested dates or the selected edition change;
  // debounced so picking a start date doesn't fire a request per keystroke/day-click.
  useEffect(() => {
    if (!dateRange || kit.isOutOfStock) {
      setAvailability({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setAvailability({ status: 'checking' });
    const timer = setTimeout(() => {
      checkAvailability({
        pickupAt: new Date(`${dateRange.start}T00:00:00`).toISOString(),
        returnAt: new Date(`${dateRange.end}T00:00:00`).toISOString(),
        packageCode: effectivePackageCode,
      })
        .then((result) => {
          if (cancelled) return;
          setAvailability(result.available ? { status: 'available' } : { status: 'unavailable', issues: result.issues });
        })
        .catch(() => {
          if (!cancelled) setAvailability({ status: 'error' });
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dateRange, effectivePackageCode, kit.isOutOfStock]);

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
      addKit({
        ...kit,
        id: selectedEdition.id,
        name: `${kit.name} (${selectedEdition.label})`,
        imageUrl: selectedEdition.imageUrl,
        editions: undefined,
      });
    } else {
      addKit(kit);
    }
  }

  function handleRemove() {
    removeKit(effectiveId);
  }

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-surface-strong">
          {imageFailed || !displayImage ? (
            <GearPlaceholderIcon className="h-10 w-10 text-ink-faint" />
          ) : (
            <img
              src={displayImage}
              alt={kit.name}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {kit.editions && (
          <div className="flex gap-2">
            {kit.editions.map((edition) => (
              <button
                key={edition.id}
                type="button"
                onClick={() => setSelectedEditionId(edition.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedEditionId === edition.id
                    ? 'bg-brand-forest text-white'
                    : 'bg-surface-strong text-ink-muted hover:bg-line'
                }`}
              >
                {edition.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-ink">{kit.name}</h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {kit.isOutOfStock && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                Out of Stock
              </span>
            )}
            {kit.paxRange && (
              <span className="rounded-full bg-surface-strong px-2 py-0.5 text-xs font-medium text-ink-muted">
                {kit.paxRange}
              </span>
            )}
          </div>
        </div>
        <PackageContents kit={kit} />

        {isSelected && kit.extras && kit.extras.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg bg-surface-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Optional Add-ons</p>
            {kit.extras.map((extra) => {
              const isChecked = selectedExtraIds.includes(extra.id);
              return (
                <label key={extra.id} className="flex items-center justify-between gap-2 text-sm text-ink">
                  <span className="flex items-center gap-2">
                    {extra.imageUrl && (
                      <img src={extra.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
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

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex items-center justify-between border-t border-line-soft pt-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Package Price</p>
            <p className="text-lg font-bold text-ink">
              {price !== null ? formatCurrency(price) : `${formatCurrency(kit.pricing['48h'])}–${formatCurrency(kit.pricing['72h'])}`}
            </p>
            {selectedDuration === '48h' && !kit.isOutOfStock && (
              <p className="text-xs font-medium text-accent">
                Add {formatCurrency(getSeventyTwoHourUpsellDelta(kit.pricing))} to rent for 72h instead
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Deposit</p>
            <p className="text-sm font-semibold text-ink">{formatCurrency(kit.depositAmount)}</p>
          </div>
        </div>

        {kit.isOutOfStock ? (
          <span className="w-full rounded-lg bg-surface-strong px-4 py-2.5 text-center text-sm font-semibold text-ink-faint">
            Out of Stock
          </span>
        ) : !selectedDuration ? (
          <button
            type="button"
            onClick={scrollToDurationPicker}
            className="w-full rounded-lg bg-surface-strong px-4 py-2.5 text-center text-sm font-semibold text-ink-muted transition-colors hover:bg-line"
          >
            Select Duration to Book
          </button>
        ) : isSelected ? (
          // Already in the cart — removable regardless of what a later availability re-check says,
          // so a customer can never get stuck unable to remove a selection that just went stale.
          <button
            type="button"
            onClick={handleRemove}
            className="w-full rounded-lg border border-brand-forest bg-brand-forest/10 px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-brand-forest/15"
          >
            Remove from Cart
          </button>
        ) : availability.status === 'checking' ? (
          <span className="w-full rounded-lg bg-surface-strong px-4 py-2.5 text-center text-sm font-semibold text-ink-faint" aria-busy>
            Checking availability…
          </span>
        ) : availability.status === 'unavailable' ? (
          <div className="flex flex-col gap-1">
            <span className="w-full rounded-lg bg-surface-strong px-4 py-2.5 text-center text-sm font-semibold text-ink-faint">
              Unavailable for these dates
            </span>
            <p className="text-center text-xs text-ink-faint">Try different dates, or check back later.</p>
          </div>
        ) : availability.status === 'error' ? (
          <span className="w-full rounded-lg bg-surface-strong px-4 py-2.5 text-center text-sm font-semibold text-ink-faint">
            Couldn't check availability — try again
          </span>
        ) : availability.status === 'idle' ? (
          <span className="w-full rounded-lg bg-surface-strong px-4 py-2.5 text-center text-sm font-semibold text-ink-faint">
            Select a start date to check availability
          </span>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            className="w-full rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
          >
            {user ? 'Available for your dates — Book This Package →' : 'Log In to Rent'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PathACatalog() {
  const { kits } = useCatalog();
  const { cart, totals, updateTripDetails } = useRental();
  const [searchQuery, setSearchQuery] = useState('');
  // Free-text guest count, not a capacity dropdown — see the Group Size audit note below.
  const [guestCountInput, setGuestCountInput] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<PackageDuration | null>(() =>
    durationFromDates(cart.tripDetails.startDate, cart.tripDetails.returnDate),
  );
  // Whole days added on top of the 72h preset — see the "Want to rent longer?" control below.
  // Restored from any already-saved dates so navigating away and back doesn't silently drop it
  // (the dates themselves already persist in cart.tripDetails; this keeps the picker's own display
  // in sync with them, same reasoning as durationFromDates above).
  const [extraDays, setExtraDays] = useState(() =>
    extraDaysFromDates(cart.tripDetails.startDate, cart.tripDetails.returnDate),
  );

  const cartItemCount = cart.selectedKits.length + cart.selectedItems.length;

  // Memoized so its identity only changes when the actual dates do — PackageCard's availability
  // effect depends on this whole object, and without this it would re-fire on every unrelated
  // parent re-render (e.g. toggling the group-size filter) since a plain inline literal here would
  // be a new object every render.
  const dateRange: DateRange | null = useMemo(
    () =>
      cart.tripDetails.startDate && cart.tripDetails.returnDate
        ? { start: cart.tripDetails.startDate, end: cart.tripDetails.returnDate }
        : null,
    [cart.tripDetails.startDate, cart.tripDetails.returnDate],
  );

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

  function handleDurationSelect(preset: PackageDuration) {
    setSelectedDuration(preset);
    // Extra days only ever stack on top of 72h — switching to 48h always clears them, so a
    // previously-chosen "+2 extra days" can never silently reappear once 72h is picked again.
    const nextExtraDays = preset === '72h' ? extraDays : 0;
    setExtraDays(nextExtraDays);
    // TODAY (the customer's local day), not getDurationRange's own default — that default is the
    // UTC day, which would seed a start date below this field's own `min` for the first 8 hours of
    // every Philippine day.
    updateTripDetails(getDurationRange(preset, cart.tripDetails.startDate || TODAY, nextExtraDays));
  }

  function handleStartDateChange(value: string) {
    if (!selectedDuration) return;
    // A date input can be cleared to '' (and a partially-typed date reads as invalid), which
    // getDurationRange would turn into an Invalid Date and throw on — clearing the field just
    // clears both dates instead, which the availability check already treats as "no range yet".
    if (!value || Number.isNaN(new Date(value).getTime())) {
      updateTripDetails({ startDate: '', returnDate: '' });
      return;
    }
    updateTripDetails(getDurationRange(selectedDuration, value, extraDays));
  }

  /** Only reachable while `selectedDuration === '72h'` (see the control itself) — clamped to never
   *  go negative, since there's no "-1 extra day" concept. */
  function handleExtraDaysChange(next: number) {
    const clamped = Math.max(0, next);
    setExtraDays(clamped);
    updateTripDetails(getDurationRange('72h', cart.tripDetails.startDate || TODAY, clamped));
  }

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-5 sm:p-6">
        <BackLink to="/catalog" label="Back to Browse Gear" />
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-xl font-semibold text-ink">Choose a Package</h1>
          <p className="text-sm text-ink-muted">
            Ready-made kits, bundled and priced as a single unit. Deposits and rental terms follow our shared{' '}
            <Link to="/terms" className="font-medium text-accent underline underline-offset-2">
              Rental Agreement
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-col space-y-6 rounded-2xl border border-line/80 bg-surface-muted/60 p-6 shadow-sm md:p-8">
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
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
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
                  : 'Optional — we’ll show packages sized for your group where that’s known.'}
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

          {/* Both dates read from (and write back to) the shared cart trip details — the same
              state Checkout's own Trip Details form and every package card's live RMS availability
              check already use, so there's no second, separate date state to keep in sync. */}
          <div>
            <span className={CONTROL_LABEL_CLASS}>Rental Dates</span>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Start Date</span>
                <input
                  type="date"
                  value={cart.tripDetails.startDate}
                  min={TODAY}
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
                  value={cart.tripDetails.returnDate}
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

        {visibleKits.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
            No packages match {normalizedSearch ? `"${searchQuery.trim()}"` : 'this guest count'}. Try a different
            search or guest count.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleKits.map((kit) => (
              <PackageCard key={kit.id} kit={kit} dateRange={dateRange} selectedDuration={selectedDuration} />
            ))}
          </div>
        )}

        {/* Contextual help right where indecision actually happens — after browsing every
         * package, not layered on top of any card or its Select Duration/Book action. Compact,
         * green-tinted horizontal banner (never a package-card lookalike) per the client's
         * reference: help copy + icon on the left, a dark "Message Us" pill and small social row
         * on the right. */}
        <div className="rounded-2xl border border-brand-forest/15 bg-brand-forest/5 p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-sm">
                <CampfireIcon className="h-5 w-5" />
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-bold text-ink sm:text-lg">Still deciding?</h2>
                <p className="text-sm text-ink-muted">
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
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
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
