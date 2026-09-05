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
  const { cart, addItem, removeItem, updateTripDetails } = useRental();
  const [imageFailed, setImageFailed] = useState(false);

  const isSelected = cart.selectedItems.some((selected) => selected.id === item.id);
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
      navigate('/login', { state: { from: location.pathname } });
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
            <h2 className="text-lg font-semibold text-ink">{item.name}</h2>
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

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Start Date</span>
            <input
              type="date"
              value={cart.tripDetails.startDate}
              onChange={(e) => updateTripDetails({ startDate: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">End Date</span>
            <input
              type="date"
              value={cart.tripDetails.returnDate}
              min={cart.tripDetails.startDate}
              onChange={(e) => updateTripDetails({ returnDate: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
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
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Deposit</p>
            <p className="text-sm font-semibold text-ink">{formatCurrency(item.depositAmount)}</p>
          </div>
        </div>

        {!hasDates ? (
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
                ? 'border border-brand-forest bg-brand-forest/10 text-brand-forest hover:bg-brand-forest/15'
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
