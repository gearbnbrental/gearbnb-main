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
    setPackageAddOnQuantity,
    toggleKitSelected,
    toggleItemSelected,
    toggleByoGearSelected,
    togglePackageAddOnSelected,
    toggleByoAddOnSelected,
    setAllCheckoutSelected,
    dismissRemovedNotice,
    totals,
  } = useRental();
  const { selectedKits, selectedItems, kitExtras, packageAddOns, byoGears, byoAddOns, checkoutSelection, removedItemNames } =
    cart;
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
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-5 py-12 text-center sm:px-6 sm:py-20">
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
    // pb-56 (not pb-28): extra safety margin for the true end of a long cart — this route lifts
    // the floating Need Help/Back to Top buttons clear of the sticky checkout bar (see
    // STICKY_FOOTER_ROUTES), but with both visible (BackToTop appears past 480px scrolled,
    // stacking above Need Help) their combined footprint reaches ~208px above the viewport
    // bottom, more than pb-28 (112px) cleared. (The Terms & Conditions overlap this was originally
    // written to describe turned out to need a different fix — see the disclaimer's own comment
    // above, where it was moved out of the vulnerable position entirely.)
    <div className="pb-56">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5 sm:gap-6 sm:px-6 sm:py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-lg font-semibold text-ink sm:text-xl">Your Cart</h1>
          <Link to="/catalog" className="text-sm font-medium text-accent underline underline-offset-2">
            + Add more
          </Link>
        </div>

        {removedNotice}

        <div className="flex items-start justify-between gap-3">
          {/* The "Terms & Conditions" disclaimer used to sit alone at the very bottom of the page,
              right above the sticky checkout bar — for a cart with enough items to fill roughly one
              phone screen, that position coincides with where the lifted floating Need Help/Back to
              Top buttons sit on screen (confirmed via a seeded multi-item cart screenshot), covering
              the link. Moving it up here, beside the checkout-selection disclaimer that already
              lives at the top of every cart regardless of length, puts it somewhere floating
              buttons never reach. */}
          <p className="text-xs text-ink-faint">
            Check which items to include in this checkout — an unchecked item stays saved in your cart. Bookings are
            submitted one package or one Build Your Own selection at a time. By booking you agree to our{' '}
            <Link to="/terms" className="font-medium text-accent underline underline-offset-2">
              Terms &amp; Conditions
            </Link>
            .
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
                  className={`flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm transition-opacity sm:p-4 ${isChecked ? '' : 'opacity-60'}`}
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

                  {/* Both extras and add-ons sit on a tinted inset block with a left accent bar,
                      inside the SAME package card (never a separate nested card) — connected to
                      the package above it by staying in that one card, distinguished from it by
                      the tint + border so a customer can tell at a glance "this is extra, not part
                      of what I already saw priced above." sm:ml-[5.75rem] shifts the whole block
                      to align under the name/price column instead of the thumbnail, matching the
                      layout every other sub-line in this card already uses. */}
                  {selectedExtras.length > 0 && (
                    <div className="flex flex-col gap-1.5 rounded-lg border-l-2 border-brand-forest/30 bg-surface-muted p-2.5 sm:ml-[5.75rem]">
                      <ul className="flex flex-col gap-1.5">
                        {selectedExtras.map((extra) => (
                          <li key={extra.id} className="flex items-center justify-between text-sm text-ink-muted">
                            <span className="min-w-0 break-words">{extra.name}</span>
                            <span className="flex shrink-0 items-center gap-2">
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
                    </div>
                  )}

                  {/* Extra rentable inventory added on top of this package — labelled and priced as
                      its own lines under an explicit "Optional Add-ons" heading, never merged into
                      the package's name or price above, so it's always clear these are additional
                      rentals rather than package contents. Each add-on has its own checkbox,
                      independent of the package's: unchecking it excludes just that add-on from
                      this checkout while it stays in the cart (and the package, and every other
                      add-on, untouched) — a separate, permanent action from Remove below. */}
                  {(packageAddOns[kit.id] ?? []).length > 0 && (
                    <div className="flex flex-col gap-1.5 rounded-lg border-l-2 border-brand-forest/30 bg-surface-muted p-2.5 sm:ml-[5.75rem]">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Optional Add-ons</p>
                      <ul className="flex flex-col gap-1.5">
                        {(packageAddOns[kit.id] ?? []).map((gear) => {
                          const addOnKey = byoGearKey(gear);
                          const isAddOnChecked = (checkoutSelection.packageAddOnKeys[kit.id] ?? []).includes(addOnKey);
                          return (
                            <li
                              key={addOnKey}
                              className={`flex items-center justify-between gap-2 text-sm text-ink-muted transition-opacity ${isAddOnChecked ? '' : 'opacity-60'}`}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isAddOnChecked}
                                  onChange={() => togglePackageAddOnSelected(kit.id, addOnKey)}
                                  aria-label={`Include ${gear.name} in this checkout`}
                                  className="h-3.5 w-3.5 shrink-0 rounded border-line text-accent focus:ring-brand-forest"
                                />
                                <span className="min-w-0 break-words">
                                  {gear.name}
                                  {gear.quantity > 1 && ` × ${gear.quantity}`}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                {formatCurrency(getGearKindPrice(gear, cart.tripDetails) * gear.quantity)}
                                <button
                                  type="button"
                                  onClick={() => setPackageAddOnQuantity(kit.id, gear, 0)}
                                  className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                                >
                                  Remove
                                </button>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
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
                className={`flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm transition-opacity sm:p-4 ${isChecked ? '' : 'opacity-60'}`}
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
                  className={`flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm transition-opacity sm:p-4 ${isChecked ? '' : 'opacity-60'}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <CheckboxInput
                      checked={isChecked}
                      onChange={() => toggleByoGearSelected(key)}
                      label={`Include ${gear.name} in this checkout`}
                    />
                    <Thumbnail src={gear.imageUrl ?? ''} alt={gear.name} />
                    {/* On phones this column claims the rest of the first line (everything but the
                        checkbox and thumbnail — 6.5rem), so the quantity control and trash wrap onto
                        their own line. With a plain min-w-0 it would shrink to nothing instead:
                        at 375px the gear name was crushed to a single character. */}
                    <div className="min-w-[calc(100%-6.5rem)] flex-1 sm:min-w-0">
                      <p className="break-words font-medium text-ink sm:truncate">{gear.name}</p>
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
                    <p className="text-xs text-ink-muted sm:pl-[5.75rem]">
                      Subtotal: {formatCurrency(unitPrice * gear.quantity)}
                    </p>
                  )}

                  {selectedAddOns.length > 0 && (
                    <ul className="flex flex-col gap-2 border-t border-line-soft pt-2 sm:pl-[5.75rem]">
                      {selectedAddOns.map((addOn) => {
                        const addOnUnitPrice = getGearKindPrice(addOn, cart.tripDetails);
                        const addOnKey = byoGearKey(addOn);
                        // Independent of the gear's own checkbox above: unchecking this excludes
                        // just this add-on from checkout while it (and its quantity) stay in the
                        // cart — a separate, non-destructive action from the quantity stepper below
                        // reaching 0, which still permanently removes it.
                        const isAddOnChecked = (checkoutSelection.byoAddOnKeys[key] ?? []).includes(addOnKey);
                        return (
                          // Stacked on phones: name on its own line, price and quantity control
                          // beneath it. Side by side, a 136px stepper plus the price left the name
                          // only a few characters before it truncated.
                          <li
                            key={addOnKey}
                            className={`flex flex-col gap-1.5 text-sm text-ink-muted transition-opacity sm:flex-row sm:items-center sm:justify-between sm:gap-2 ${isAddOnChecked ? '' : 'opacity-60'}`}
                          >
                            <span className="flex min-w-0 items-center gap-2 sm:truncate">
                              <input
                                type="checkbox"
                                checked={isAddOnChecked}
                                onChange={() => toggleByoAddOnSelected(key, addOnKey)}
                                aria-label={`Include ${addOn.name} in this checkout`}
                                className="h-3.5 w-3.5 shrink-0 rounded border-line text-accent focus:ring-brand-forest"
                              />
                              <span className="min-w-0 break-words sm:truncate">{addOn.name}</span>
                            </span>
                            <span className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
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
