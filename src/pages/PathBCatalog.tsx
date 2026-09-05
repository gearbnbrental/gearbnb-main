import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import GearDetailsModal from '../components/GearDetailsModal';
import { ChevronIcon, GearPlaceholderIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { checkItemAvailability, getItemPrice, useRental } from '../context/RentalContext';
import type { DateRange, DurationPresetId, IndividualItem } from '../types/gearbnb';
import { DURATION_PRESETS, getDurationRange } from '../utils/duration';
import { formatCurrency } from '../utils/format';

const ITEMS_PAGE_SIZE = 9;

interface ItemCardProps {
  item: IndividualItem;
  price: number;
  isSelected: boolean;
  isAvailable: boolean;
  isAuthenticated: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onViewDetails: () => void;
}

function ItemCard({ item, price, isSelected, isAvailable, isAuthenticated, onAdd, onRemove, onViewDetails }: ItemCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <button type="button" onClick={onViewDetails} className="flex flex-col gap-3 text-left">
        <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-surface-strong">
          {imageFailed || !item.imageUrl ? (
            <GearPlaceholderIcon className="h-10 w-10 text-ink-faint" />
          ) : (
            <img
              src={item.imageUrl}
              alt={item.name}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">{item.name}</h3>
          <p className="text-xs text-ink-faint">{item.category}</p>
        </div>
      </button>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-t border-line-soft pt-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Rental Fee</p>
            <p className="text-sm font-semibold text-ink">{formatCurrency(price)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Deposit</p>
            <p className="text-sm font-semibold text-ink">{formatCurrency(item.depositAmount)}</p>
          </div>
        </div>

        {!isAvailable ? (
          <span className="w-full rounded-lg bg-surface-strong px-4 py-2 text-center text-sm font-semibold text-ink-faint">
            Unavailable for selected dates
          </span>
        ) : (
          <button
            type="button"
            onClick={isSelected ? onRemove : onAdd}
            className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              isSelected
                ? 'border border-brand-forest bg-brand-forest/10 text-brand-forest hover:bg-brand-forest/15'
                : 'bg-brand-forest text-white shadow-sm hover:bg-brand-forest-dark'
            }`}
          >
            {isSelected ? 'Remove from Cart' : isAuthenticated ? 'Add Item to Cart' : 'Log In to Rent'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PathBCatalog() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { items } = useCatalog();
  const { cart, addItem, removeItem, totals, updateTripDetails } = useRental();
  const [selectedPreset, setSelectedPreset] = useState<DurationPresetId | 'custom' | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [itemsPage, setItemsPage] = useState(1);
  const [detailsItem, setDetailsItem] = useState<IndividualItem | null>(null);

  function handleAddItem(item: IndividualItem) {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    addItem(item);
  }

  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.category)));
    return ['All', ...unique];
  }, [items]);

  const selectedItemIds = new Set(cart.selectedItems.map((item) => item.id));
  const cartItemCount = cart.selectedKits.length + cart.selectedItems.length;
  const isUnlocked = totals.rentalDurationDays > 0;

  const dateRange: DateRange | null =
    cart.tripDetails.startDate && cart.tripDetails.returnDate
      ? { start: cart.tripDetails.startDate, end: cart.tripDetails.returnDate }
      : null;

  const filteredItems =
    activeCategory === 'All' ? items : items.filter((item) => item.category === activeCategory);

  const itemsPageCount = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PAGE_SIZE));
  const paginatedItems = filteredItems.slice(
    (itemsPage - 1) * ITEMS_PAGE_SIZE,
    itemsPage * ITEMS_PAGE_SIZE,
  );

  function handleCategorySelect(category: string) {
    setActiveCategory(category);
    setItemsPage(1);
  }

  function handlePresetSelect(preset: DurationPresetId) {
    setSelectedPreset(preset);
    updateTripDetails(getDurationRange(preset));
  }

  function handleCustomToggle() {
    setSelectedPreset('custom');
  }

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-xl font-semibold text-ink">Build Your Own</h1>
          <p className="text-sm text-ink-muted">Pick your rental duration first, then mix and match individual gear.</p>
          <p className="text-xs text-ink-faint">
            Add-on pricing shown is an estimate — GearBnB confirms final rates at booking.{' '}
            <Link to="/terms" className="font-medium text-brand-forest underline underline-offset-2">
              View Terms &amp; Conditions
            </Link>
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-muted p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Rental Duration</span>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedPreset === preset.id
                    ? 'bg-brand-forest text-white'
                    : 'bg-surface text-ink-muted hover:bg-surface-strong'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleCustomToggle}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedPreset === 'custom' ? 'bg-brand-forest text-white' : 'bg-surface text-ink-muted hover:bg-surface-strong'
              }`}
            >
              Custom
            </button>
          </div>

          {selectedPreset === 'custom' && (
            <div className="flex flex-wrap gap-3 pt-1">
              <input
                type="date"
                value={cart.tripDetails.startDate}
                onChange={(e) => updateTripDetails({ startDate: e.target.value })}
                className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
              />
              <input
                type="date"
                value={cart.tripDetails.returnDate}
                min={cart.tripDetails.startDate}
                onChange={(e) => updateTripDetails({ returnDate: e.target.value })}
                className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
              />
            </div>
          )}
        </div>

        <div className="relative flex flex-col gap-6">
          {!isUnlocked && (
            <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-surface/80 pt-16 backdrop-blur-sm">
              <p className="rounded-full bg-gray-900/90 px-4 py-2 text-sm font-medium text-white">
                Select your rental duration above to browse gear
              </p>
            </div>
          )}

          <div className={!isUnlocked ? 'pointer-events-none opacity-40' : undefined}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2">
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

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    price={getItemPrice(item, cart.tripDetails)}
                    isSelected={selectedItemIds.has(item.id)}
                    isAvailable={checkItemAvailability(item, dateRange)}
                    isAuthenticated={Boolean(user)}
                    onAdd={() => handleAddItem(item)}
                    onRemove={() => removeItem(item.id)}
                    onViewDetails={() => setDetailsItem(item)}
                  />
                ))}
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
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
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

      {detailsItem && <GearDetailsModal item={detailsItem} onClose={() => setDetailsItem(null)} />}
    </div>
  );
}
