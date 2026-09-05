import { Link } from 'react-router-dom';
import { getItemPrice, getKitPrice, useRental } from '../context/RentalContext';
import { formatCurrency } from '../utils/format';

export default function Cart() {
  const { cart, removeKit, removeKitExtra, removeItem, totals } = useRental();
  const { selectedKits, selectedItems, kitExtras } = cart;
  const hasSelection = selectedKits.length > 0 || selectedItems.length > 0;

  if (!hasSelection) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-20 text-center sm:px-6">
        <h1 className="font-serif text-xl font-semibold text-ink">Your Cart is Empty</h1>
        <p className="text-sm text-ink-muted">Add a package or individual gear to get started.</p>
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
      <h1 className="font-serif text-xl font-semibold text-ink">Your Cart</h1>

      {selectedKits.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Packages</h2>
          {selectedKits.map((kit) => {
            const selectedExtraIds = kitExtras[kit.id] ?? [];
            const selectedExtras = (kit.extras ?? []).filter((extra) => selectedExtraIds.includes(extra.id));
            return (
              <div key={kit.id} className="flex flex-col gap-3 rounded-xl border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{kit.name}</p>
                    <p className="text-xs text-ink-muted">
                      {formatCurrency(getKitPrice(kit, cart.tripDetails))} package &middot; {formatCurrency(kit.depositAmount)} deposit
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeKit(kit.id)}
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </div>

                {selectedExtras.length > 0 && (
                  <ul className="flex flex-col gap-1.5 border-t border-line-soft pt-2">
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
          {selectedItems.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-line p-4">
              <div>
                <p className="font-medium text-ink">{item.name}</p>
                <p className="text-xs text-ink-muted">
                  {formatCurrency(getItemPrice(item, cart.tripDetails))} rental fee &middot;{' '}
                  {formatCurrency(item.depositAmount)} deposit
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-xl bg-surface-muted p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-ink-muted">Security Deposit Total</span>
          <span className="font-semibold text-ink">{formatCurrency(totals.dueToday)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-ink-muted">Rental Fee Total</span>
          <span className="font-semibold text-ink">{formatCurrency(totals.dueBeforeStart)}</span>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Link
          to="/checkout"
          className="flex-1 rounded-lg bg-brand-forest px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
        >
          Proceed to Checkout &rarr;
        </Link>
        <Link
          to="/catalog"
          className="flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-center text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-muted"
        >
          Continue Shopping
        </Link>
      </div>

      <p className="text-center text-xs text-ink-faint">
        By booking you agree to our{' '}
        <Link to="/terms" className="font-medium text-brand-forest underline underline-offset-2">
          Terms &amp; Conditions
        </Link>
        .
      </p>
    </div>
  );
}
