import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckIcon, GearPlaceholderIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { checkKitAvailability, useRental } from '../context/RentalContext';
import type { DateRange, DurationPresetId, PackageKit } from '../types/gearbnb';
import { DURATION_PRESETS, getDurationRange } from '../utils/duration';
import { formatCurrency } from '../utils/format';

type PackageDuration = Extract<DurationPresetId, '48h' | '72h'>;

const PACKAGE_DURATION_PRESETS = DURATION_PRESETS.filter(
  (preset): preset is { id: PackageDuration; label: string; days: number } => preset.id !== '24h',
);

function scrollToDurationPicker() {
  document.getElementById('package-duration-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

interface PackageCardProps {
  kit: PackageKit;
  isAvailable: boolean;
  selectedDuration: PackageDuration | null;
}

function PackageCard({ kit, isAvailable, selectedDuration }: PackageCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, addKit, removeKit, addKitExtra, removeKitExtra } = useRental();
  const [selectedEditionId, setSelectedEditionId] = useState(kit.editions?.[0]?.id);
  const [imageFailed, setImageFailed] = useState(false);

  // The specific edition chosen (if any) becomes the cart item's real identity — this is what
  // gets submitted as the booking's package_id, so "Khaki" must never silently save as "Black".
  const selectedEdition = kit.editions?.find((edition) => edition.id === selectedEditionId);
  const effectiveId = selectedEdition?.id ?? kit.id;
  const isSelected = cart.selectedKits.some((selected) => selected.id === effectiveId);
  const selectedExtraIds = cart.kitExtras[effectiveId] ?? [];

  const displayImage = selectedEdition?.imageUrl || kit.imageUrl;
  const price = selectedDuration ? kit.pricing[selectedDuration] : null;

  function handleAdd() {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
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
          {kit.paxRange && (
            <span className="shrink-0 rounded-full bg-surface-strong px-2 py-0.5 text-xs font-medium text-ink-muted">
              {kit.paxRange}
            </span>
          )}
        </div>
        <p className="text-sm text-ink-muted">{kit.description}</p>
        <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
          {kit.includedItems.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 shrink-0 text-brand-forest" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

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
                      className="h-4 w-4 rounded border-line text-brand-forest focus:ring-brand-forest"
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
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Deposit</p>
            <p className="text-sm font-semibold text-ink">{formatCurrency(kit.depositAmount)}</p>
          </div>
        </div>

        {!selectedDuration ? (
          <button
            type="button"
            onClick={scrollToDurationPicker}
            className="w-full rounded-lg bg-surface-strong px-4 py-2.5 text-center text-sm font-semibold text-ink-muted transition-colors hover:bg-line"
          >
            Select Duration to Book
          </button>
        ) : !isAvailable ? (
          <span className="w-full rounded-lg bg-surface-strong px-4 py-2.5 text-center text-sm font-semibold text-ink-faint">
            Unavailable for selected dates
          </span>
        ) : (
          <button
            type="button"
            onClick={isSelected ? handleRemove : handleAdd}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              isSelected
                ? 'border border-brand-forest bg-brand-forest/10 text-brand-forest hover:bg-brand-forest/15'
                : 'bg-brand-forest text-white shadow-sm hover:bg-brand-forest-dark'
            }`}
          >
            {isSelected ? 'Remove from Cart' : user ? 'Book This Package →' : 'Log In to Rent'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PathACatalog() {
  const { kits } = useCatalog();
  const { cart, totals, updateTripDetails } = useRental();
  const [groupSizeFilter, setGroupSizeFilter] = useState<number | 'any'>('any');
  const [selectedDuration, setSelectedDuration] = useState<PackageDuration | null>(null);

  const cartItemCount = cart.selectedKits.length + cart.selectedItems.length;

  const dateRange: DateRange | null =
    cart.tripDetails.startDate && cart.tripDetails.returnDate
      ? { start: cart.tripDetails.startDate, end: cart.tripDetails.returnDate }
      : null;

  // Real Package rows don't carry a capacity yet, so 0 means "unknown" — excluded from filter
  // options; those kits still show up under "Any".
  const groupSizes = useMemo(
    () => Array.from(new Set(kits.map((kit) => kit.capacity).filter((size) => size > 0))).sort((a, b) => a - b),
    [kits],
  );

  const visibleKits = useMemo(
    () => (groupSizeFilter === 'any' ? kits : kits.filter((kit) => kit.capacity === groupSizeFilter)),
    [kits, groupSizeFilter],
  );

  function handleDurationSelect(preset: PackageDuration) {
    setSelectedDuration(preset);
    updateTripDetails(getDurationRange(preset, cart.tripDetails.startDate || undefined));
  }

  function handleStartDateChange(value: string) {
    if (!selectedDuration) return;
    updateTripDetails(getDurationRange(selectedDuration, value));
  }

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-xl font-semibold text-ink">Choose a Package</h1>
          <p className="text-sm text-ink-muted">
            Ready-made kits, bundled and priced as a single unit. Deposits and rental terms follow our shared{' '}
            <Link to="/terms" className="font-medium text-brand-forest underline underline-offset-2">
              Rental Agreement
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-muted p-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Group Size</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGroupSizeFilter('any')}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  groupSizeFilter === 'any' ? 'bg-brand-forest text-white' : 'bg-surface text-ink-muted hover:bg-surface-strong'
                }`}
              >
                Any
              </button>
              {groupSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setGroupSizeFilter(size)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    groupSizeFilter === size ? 'bg-brand-forest text-white' : 'bg-surface text-ink-muted hover:bg-surface-strong'
                  }`}
                >
                  Up to {size}
                </button>
              ))}
            </div>
          </div>

          <div id="package-duration-picker" className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Rental Duration</span>
            <div className="flex flex-wrap gap-2">
              {PACKAGE_DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleDurationSelect(preset.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    selectedDuration === preset.id
                      ? 'bg-brand-forest text-white'
                      : 'bg-surface text-ink-muted hover:bg-surface-strong'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {selectedDuration && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Start Date (optional)</span>
              <input
                type="date"
                value={cart.tripDetails.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-fit rounded-lg border border-line px-3 py-1.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
              />
            </label>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleKits.map((kit) => (
            <PackageCard
              key={kit.id}
              kit={kit}
              isAvailable={checkKitAvailability(kit, dateRange)}
              selectedDuration={selectedDuration}
            />
          ))}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
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
