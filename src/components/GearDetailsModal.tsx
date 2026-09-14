import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  calculateRentalDurationDays,
  checkItemAvailability,
  getItemPrice,
  useRental,
} from '../context/RentalContext';
import type { DateRange, IndividualItem } from '../types/gearbnb';
import { getSeventyTwoHourUpsellDelta } from '../utils/duration';
import { formatCurrency } from '../utils/format';
import { GearPlaceholderIcon } from './icons';

interface GearDetailsModalProps {
  item: IndividualItem;
  onClose: () => void;
}

export default function GearDetailsModal({ item, onClose }: GearDetailsModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, addItem, removeItem, addItemExtra, removeItemExtra, updateTripDetails } = useRental();
  const [imageFailed, setImageFailed] = useState(false);

  const isSelected = cart.selectedItems.some((selected) => selected.id === item.id);
  const selectedExtraIds = cart.itemExtras[item.id] ?? [];
  const durationDays = calculateRentalDurationDays(cart.tripDetails);
  const hasDates = durationDays > 0;
  const price = hasDates ? getItemPrice(item, cart.tripDetails) : null;

  const dateRange: DateRange | null =
    cart.tripDetails.startDate && cart.tripDetails.returnDate
      ? { start: cart.tripDetails.startDate, end: cart.tripDetails.returnDate }
      : null;
  const isAvailable = checkItemAvailability(item, dateRange);

  function handleConfirm() {
    if (!user) {
      onClose();
      navigate('/login', {
        state: {
          from: location.pathname,
          mode: 'login',
          reason: 'Please log in or create an account to add this item to your cart.',
        },
      });
      return;
    }
    if (isSelected) {
      removeItem(item.id);
    } else {
      addItem(item);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">{item.name}</h2>
              {item.isOutOfStock && (
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                  Out of Stock
                </span>
              )}
            </div>
            <p className="text-xs text-ink-faint">{item.category}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
          >
            &times;
          </button>
        </div>

        <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-surface-strong">
          {imageFailed || !item.imageUrl ? (
            <GearPlaceholderIcon className="h-12 w-12 text-ink-faint" />
          ) : (
            <img
              src={item.imageUrl}
              alt={item.name}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {item.includedAccessories && item.includedAccessories.length > 0 && (
          <p className="text-sm font-medium text-accent">
            🎁 Free use of {item.includedAccessories.join(' & ')}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Start Date</span>
            <input
              type="date"
              value={cart.tripDetails.startDate}
              onChange={(e) => updateTripDetails({ startDate: e.target.value })}
              className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">End Date</span>
            <input
              type="date"
              value={cart.tripDetails.returnDate}
              min={cart.tripDetails.startDate}
              onChange={(e) => updateTripDetails({ returnDate: e.target.value })}
              className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
            />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-surface-muted p-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Rental Fee</p>
            <p className="text-sm font-semibold text-ink">
              {price !== null
                ? formatCurrency(price)
                : `${formatCurrency(item.pricing['48h'])}–${formatCurrency(item.pricing['72h'])}`}
            </p>
            {durationDays === 2 && !item.isOutOfStock && (
              <p className="text-xs font-medium text-accent">
                Add {formatCurrency(getSeventyTwoHourUpsellDelta(item.pricing))} to rent for 72h instead
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Deposit</p>
            <p className="text-sm font-semibold text-ink">{formatCurrency(item.depositAmount)}</p>
          </div>
        </div>

        {isSelected && item.paidAddOns && item.paidAddOns.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg bg-surface-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Optional Add-ons</p>
            {item.paidAddOns.map((addOn) => {
              const isChecked = selectedExtraIds.includes(addOn.id);
              return (
                <label key={addOn.id} className="flex items-center justify-between gap-2 text-sm text-ink">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        isChecked ? removeItemExtra(item.id, addOn.id) : addItemExtra(item.id, addOn.id)
                      }
                      className="h-4 w-4 rounded border-line text-accent focus:ring-brand-forest"
                    />
                    {addOn.name}
                  </span>
                  <span>{formatCurrency(addOn.price)}</span>
                </label>
              );
            })}
          </div>
        )}

        {item.isOutOfStock ? (
          <span className="w-full rounded-lg bg-surface-strong px-4 py-2.5 text-center text-sm font-semibold text-ink-faint">
            Out of Stock
          </span>
        ) : !hasDates ? (
          <span className="w-full rounded-lg bg-surface-strong px-4 py-2.5 text-center text-sm font-semibold text-ink-faint">
            Pick a start and end date to see pricing
          </span>
        ) : !isAvailable ? (
          <span className="w-full rounded-lg bg-surface-strong px-4 py-2.5 text-center text-sm font-semibold text-ink-faint">
            Unavailable for selected dates
          </span>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              isSelected
                ? 'border border-brand-forest bg-brand-forest/10 text-accent hover:bg-brand-forest/15'
                : 'bg-brand-forest text-white shadow-sm hover:bg-brand-forest-dark'
            }`}
          >
            {isSelected ? 'Remove from Cart' : user ? 'Confirm Rental' : 'Log In to Rent'}
          </button>
        )}
      </div>
    </div>
  );
}
