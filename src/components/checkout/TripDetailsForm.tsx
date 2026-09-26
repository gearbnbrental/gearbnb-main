import { useState, type ComponentType } from 'react';
import { useRental } from '../../context/RentalContext';
import { MAX_BOOKING_DATE, TODAY } from '../../utils/duration';
import type { FulfillmentType } from '../../types/gearbnb';
import { CheckIcon, MapPinIcon, TruckIcon } from '../icons';


interface FulfillmentOptionConfig {
  value: FulfillmentType;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const FULFILLMENT_OPTIONS: FulfillmentOptionConfig[] = [
  {
    value: 'delivery',
    title: 'Grab Delivery',
    description: 'You book and pay for your own Grab to your address, GearBnB does not charge a delivery fee.',
    icon: TruckIcon,
  },
  {
    value: 'pickup',
    title: 'Self Pickup',
    description: 'Collect your gear in person from our location at your convenience, available 24/7.',
    icon: MapPinIcon,
  },
];

interface DateFieldProps {
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
}

function DateField({ label, value, min, onChange }: DateFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type="date"
        required
        value={value}
        min={min}
        max={MAX_BOOKING_DATE}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
      />
    </label>
  );
}

export default function TripDetailsForm() {
  const { cart, updateTripDetails } = useRental();
  const { tripDetails } = cart;
  const isDelivery = tripDetails.fulfillmentType === 'delivery';

  const [addressTouched, setAddressTouched] = useState(false);
  const showAddressError = isDelivery && addressTouched && tripDetails.deliveryAddress.trim() === '';

  function handleFulfillmentChange(fulfillmentType: FulfillmentType) {
    updateTripDetails({ fulfillmentType });
  }

  return (
    // No card of its own — the white "layer" (border/rounded/shadow on a `bg-surface` panel, same
    // treatment EventPlan.tsx established) now wraps the *entire* checkout flow as one piece at
    // the Checkout.tsx page level, not just this section, so Verification/Payment Breakdown sit on
    // the same panel instead of each needing (or duplicating) their own card. This wrapper only
    // keeps this section's own horizontal rhythm/padding, matching its siblings inside that shared
    // card exactly (mx-auto/max-w-2xl are harmless no-ops here since the outer card is already
    // that width — kept so this still renders correctly if ever used standalone).
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-ink">Trip Details</h2>
        <p className="text-sm text-ink-muted">Tell us when you need your gear and how you'd like to get it.</p>
      </div>

      {/* grid-cols-2 at every width — same reasoning as Path A/B's own Rental Dates fields: two
          native date inputs don't need a full-width row each on a phone. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <DateField
          label="Rental Start Date"
          value={tripDetails.startDate}
          min={TODAY}
          onChange={(value) => updateTripDetails({ startDate: value })}
        />
        <DateField
          label="Return Date"
          value={tripDetails.returnDate}
          min={tripDetails.startDate || TODAY}
          onChange={(value) => updateTripDetails({ returnDate: value })}
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Destination / Venue</span>
        <input
          type="text"
          required
          value={tripDetails.destination}
          onChange={(e) => updateTripDetails({ destination: e.target.value })}
          placeholder="e.g. Sagada, or your campsite / event venue"
          className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
        />
      </label>

      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Preferred Time</span>
        <input
          type="time"
          required
          value={tripDetails.preferredTime}
          onChange={(e) => updateTripDetails({ preferredTime: e.target.value })}
          className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Fulfillment Method</span>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Fulfillment Method">
          {FULFILLMENT_OPTIONS.map((option) => {
            const isActive = tripDetails.fulfillmentType === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => handleFulfillmentChange(option.value)}
                className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-colors ${
                  isActive
                    ? 'border-brand-forest bg-brand-forest/5'
                    : 'border-line bg-surface hover:border-brand-forest/50'
                }`}
              >
                {isActive && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-forest text-white">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                )}
                <Icon className={`h-6 w-6 ${isActive ? 'text-accent' : 'text-ink-muted'}`} />
                <span className="text-sm font-semibold text-ink">{option.title}</span>
                <span className="text-xs text-ink-muted">{option.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isDelivery && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">
            Delivery Address <span className="text-red-500 dark:text-red-400">*</span>
          </span>
          <textarea
            required
            rows={2}
            value={tripDetails.deliveryAddress}
            onBlur={() => setAddressTouched(true)}
            onChange={(e) => updateTripDetails({ deliveryAddress: e.target.value })}
            placeholder="House No., Street, Barangay, City"
            className={`resize-none rounded-lg border px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:ring-2 ${
              showAddressError
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500 dark:focus:border-red-400'
                : 'border-line focus:border-brand-forest focus:ring-brand-forest/20'
            }`}
          />
          {showAddressError && <span className="text-xs font-medium text-red-600 dark:text-red-400">Address is required for delivery.</span>}
        </label>
      )}
    </div>
  );
}
