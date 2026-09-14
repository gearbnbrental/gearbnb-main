import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GearPlaceholderIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import {
  byoGearKey,
  filterCartToSelection,
  getGearKindPrice,
  getItemPrice,
  getKitPrice,
  useRental,
} from '../context/RentalContext';
import { QuantityStepper } from './PathBCatalog';
import { formatCurrency } from '../utils/format';

function CheckboxInput({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="mt-1 h-4 w-4 shrink-0 self-start rounded border-line text-accent focus:ring-brand-forest"
    />
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  );
}

/**
 * The one destructive-removal pattern for the whole cart (Part 4: one consistent UX pattern
 * rather than a bespoke confirm per section). First tap swaps the trash icon for an inline
 * "Remove this item? / Remove / Keep item" choice instead of removing immediately — a customer
 * who taps it by accident (easy to do on a touch screen, right next to the quantity controls)
 * gets a chance to back out before the item is actually gone from their cart.
 *
 * The confirming state renders `w-full` rather than squeezing inline next to the trash icon's old
 * spot — every caller wraps this in a `flex-wrap` row, so a full-width element forces it onto its
 * own line instead of crushing the item name/thumbnail down to a sliver on a narrow phone screen.
 */
function RemoveButton({ itemLabel, onConfirm }: { itemLabel: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex w-full items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-500/10">
        <span className="text-xs font-medium text-red-700 dark:text-red-400">Remove this item?</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              onConfirm();
            }}
            className="whitespace-nowrap rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="whitespace-nowrap rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-strong"
          >
            Keep item
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label={`Remove ${itemLabel}`}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
    >
      <TrashIcon className="h-4.5 w-4.5" />
    </button>
  );
}

function Thumbnail({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-strong sm:h-20 sm:w-20">
      {failed || !src ? (
        <GearPlaceholderIcon className="h-6 w-6 text-ink-faint" />
      ) : (
        <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      )}
    </div>
  );
}

export default function Cart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    cart,
    removeKit,
    removeKitExtra,
    removeItem,
    setByoGearQuantity,
    setByoAddOnQuantity,
    toggleKitSelected,
    toggleItemSelected,
    toggleByoGearSelected,
    setAllCheckoutSelected,
    dismissRemovedNotice,
    totals,
  } = useRental();
  const { selectedKits, selectedItems, kitExtras, byoGears, byoAddOns, checkoutSelection, removedItemNames } = cart;
  const hasSelection = selectedKits.length > 0 || selectedItems.length > 0 || byoGears.length > 0;

  const totalEntryCount = selectedKits.length + selectedItems.length + byoGears.length;
  const checkedEntryCount =
    checkoutSelection.kitIds.length + checkoutSelection.itemIds.length + checkoutSelection.byoGearKeys.length;
  const allChecked = totalEntryCount > 0 && checkedEntryCount === totalEntryCount;

  // What's actually checked for checkout — a cart can legitimately hold more than one valid
  // combination at once (e.g. two packages, or a package plus a Build Your Own selection); the
  // footer below previews and "Proceed to Checkout" only ever acts on this narrowed-down subset.
  const selectedCart = filterCartToSelection(cart);
  const hasCheckedForCheckout =
    selectedCart.selectedKits.length > 0 || selectedCart.selectedItems.length > 0 || selectedCart.byoGears.length > 0;
  const isByoOnly = selectedCart.byoGears.length > 0 && selectedCart.selectedKits.length === 0;
  const totalUnitCount =
    selectedCart.selectedKits.length +
    selectedCart.selectedItems.length +
    selectedCart.byoGears.reduce((sum, gear) => sum + gear.quantity, 0);

  const removedNotice = removedItemNames.length > 0 && (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
      <p>
        {removedItemNames.length === 1
          ? `${removedItemNames[0]} is no longer available and was removed from your cart.`
          : `${removedItemNames.join(', ')} are no longer available and were removed from your cart.`}
      </p>
      <button
        type="button"
        onClick={dismissRemovedNotice}
        aria-label="Dismiss"
        className="shrink-0 text-xs font-semibold underline underline-offset-2"
      >
        Dismiss
      </button>
    </div>
  );

  if (!hasSelection) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-5 py-20 text-center sm:px-6">
        {removedNotice && <div className="w-full">{removedNotice}</div>}
        <h1 className="font-serif text-xl font-semibold text-ink">Your Cart is Empty</h1>
        <p className="text-sm text-ink-muted">Add a package or build your own to get started.</p>
        <Link
          to="/catalog"
          className="rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-xl font-semibold text-ink">Your Cart</h1>
          <Link to="/catalog" className="text-sm font-medium text-accent underline underline-offset-2">
            + Add more
          </Link>
        </div>

        {removedNotice}

        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-ink-faint">
            Check which items to include in this checkout — an unchecked item stays saved in your cart. Bookings are
            submitted one package or one Build Your Own selection at a time.
          </p>
          <button
            type="button"
            onClick={() => setAllCheckoutSelected(!allChecked)}
            className="shrink-0 whitespace-nowrap text-xs font-semibold text-accent underline underline-offset-2 hover:text-brand-forest-dark"
          >
            {allChecked ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {selectedKits.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Packages</h2>
            {selectedKits.map((kit) => {
              const selectedExtraIds = kitExtras[kit.id] ?? [];
              const selectedExtras = (kit.extras ?? []).filter((extra) => selectedExtraIds.includes(extra.id));
              const isChecked = checkoutSelection.kitIds.includes(kit.id);
              return (
                <div
                  key={kit.id}
                  className={`flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition-opacity ${isChecked ? '' : 'opacity-60'}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <CheckboxInput
                      checked={isChecked}
                      onChange={() => toggleKitSelected(kit.id)}
                      label={`Include ${kit.name} in this checkout`}
                    />
                    <Thumbnail src={kit.imageUrl} alt={kit.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{kit.name}</p>
                      <p className="text-xs text-ink-faint">Package</p>
                      <p className="text-sm text-ink-muted">
                        {formatCurrency(getKitPrice(kit, cart.tripDetails))} rental &middot;{' '}
                        {formatCurrency(kit.depositAmount)} deposit
                      </p>
                    </div>
                    <RemoveButton itemLabel={kit.name} onConfirm={() => removeKit(kit.id)} />
                  </div>

                  {selectedExtras.length > 0 && (
                    <ul className="flex flex-col gap-1.5 border-t border-line-soft pt-2 pl-[4.75rem] sm:pl-[5.75rem]">
                      {selectedExtras.map((extra) => (
                        <li key={extra.id} className="flex items-center justify-between text-sm text-ink-muted">
                          <span>{extra.name}</span>
                          <span className="flex items-center gap-2">
                            {formatCurrency(extra.price)}
                            <button
                              type="button"
                              onClick={() => removeKitExtra(kit.id, extra.id)}
                              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                            >
                              Remove
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {selectedItems.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Individual Gear</h2>
            {selectedItems.map((item) => {
              const isChecked = checkoutSelection.itemIds.includes(item.id);
              return (
              <div
                key={item.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition-opacity ${isChecked ? '' : 'opacity-60'}`}
              >
                <CheckboxInput
                  checked={isChecked}
                  onChange={() => toggleItemSelected(item.id)}
                  label={`Include ${item.name} in this checkout`}
                />
                <Thumbnail src={item.imageUrl} alt={item.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{item.name}</p>
                  <p className="text-xs text-ink-faint">Individual Gear</p>
                  <p className="text-sm text-ink-muted">
                    {formatCurrency(getItemPrice(item, cart.tripDetails))} rental &middot;{' '}
                    {formatCurrency(item.depositAmount)} deposit
                  </p>
                </div>
                <RemoveButton itemLabel={item.name} onConfirm={() => removeItem(item.id)} />
              </div>
              );
            })}
          </section>
        )}

        {byoGears.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Build Your Own</h2>
            {byoGears.map((gear) => {
              const key = byoGearKey(gear);
              const selectedAddOns = byoAddOns[key] ?? [];
              const unitPrice = getGearKindPrice(gear, cart.tripDetails);
              const isChecked = checkoutSelection.byoGearKeys.includes(key);
              return (
                <div
                  key={key}
                  className={`flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition-opacity ${isChecked ? '' : 'opacity-60'}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <CheckboxInput
                      checked={isChecked}
                      onChange={() => toggleByoGearSelected(key)}
                      label={`Include ${gear.name} in this checkout`}
                    />
                    <Thumbnail src={gear.imageUrl ?? ''} alt={gear.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{gear.name}</p>
                      <p className="text-xs text-ink-faint">Build Your Own &middot; {gear.category}</p>
                      <p className="text-sm font-semibold text-accent">
                        {formatCurrency(unitPrice)} <span className="text-xs font-normal text-ink-muted">each</span>
                      </p>
                    </div>
                    <QuantityStepper
                      value={gear.quantity}
                      max={gear.availableCount}
                      ariaLabel={gear.name}
                      onChange={(next) => setByoGearQuantity(gear, next)}
                    />
                    <RemoveButton itemLabel={gear.name} onConfirm={() => setByoGearQuantity(gear, 0)} />
                  </div>

                  {gear.quantity > 1 && (
                    <p className="pl-[4.75rem] text-xs text-ink-muted sm:pl-[5.75rem]">
                      Subtotal: {formatCurrency(unitPrice * gear.quantity)}
                    </p>
                  )}

                  {selectedAddOns.length > 0 && (
                    <ul className="flex flex-col gap-2 border-t border-line-soft pt-2 pl-[4.75rem] sm:pl-[5.75rem]">
                      {selectedAddOns.map((addOn) => {
                        const addOnUnitPrice = getGearKindPrice(addOn, cart.tripDetails);
                        return (
                          <li key={byoGearKey(addOn)} className="flex items-center justify-between gap-2 text-sm text-ink-muted">
                            <span className="min-w-0 truncate">{addOn.name}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              {formatCurrency(addOnUnitPrice * addOn.quantity)}
                              <QuantityStepper
                                value={addOn.quantity}
                                max={Math.min(addOn.maxQuantity, addOn.availableCount)}
                                ariaLabel={addOn.name}
                                onChange={(next) => setByoAddOnQuantity(key, addOn, next)}
                              />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        )}

        <p className="text-center text-xs text-ink-faint">
          By booking you agree to our{' '}
          <Link to="/terms" className="font-medium text-accent underline underline-offset-2">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              {hasCheckedForCheckout ? `${totalUnitCount} item${totalUnitCount === 1 ? '' : 's'} selected` : 'No items selected'}
            </span>
            {hasCheckedForCheckout ? (
              <span className="text-sm font-semibold text-ink">
                Deposit {isByoOnly ? 'To Be Determined' : formatCurrency(totals.dueToday)}
                <span className="mx-1.5 text-ink-faint">&bull;</span>
                Rental Fee {formatCurrency(totals.dueBeforeStart)}
              </span>
            ) : (
              <span className="text-sm text-ink-muted">Check at least one item above to continue.</span>
            )}
          </div>
          {hasCheckedForCheckout ? (
            // A plain <Link> would take a guest straight into the checkout form before they know
            // an account is required — routing through the same friendly auth-required message
            // every other gated action uses (see AuthRequiredMessage) instead of a silent redirect.
            <button
              type="button"
              onClick={() =>
                user
                  ? navigate('/checkout')
                  : navigate('/login', {
                      state: {
                        from: '/checkout',
                        mode: 'login',
                        reason: 'Please log in or create an account to continue to checkout.',
                      },
                    })
              }
              className="rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
            >
              Proceed to Checkout &rarr;
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg bg-surface-strong px-6 py-3 text-sm font-semibold text-ink-faint"
            >
              Proceed to Checkout &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
