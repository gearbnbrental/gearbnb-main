import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/format';

interface BookingLineItem {
  name: string;
  quantity: number;
}

interface MyBookingRow {
  booking_id: string;
  booking_number: string;
  status: string;
  pickup_at: string;
  return_at: string;
  rental_fee_centavos: number;
  deposit_centavos: number;
  packages: BookingLineItem[] | null;
  gears: BookingLineItem[] | null;
}

type FetchState =
  | { kind: 'loading' }
  | { kind: 'not_configured' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; bookings: MyBookingRow[] };

const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  AWAITING_CUSTOMER_RESPONSE: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  AWAITING_PAYMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  PENDING_FOR_INSPECTION: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  RESERVED: 'bg-blue-100 text-blue-800 dark:bg-blue-400/10 dark:text-blue-300',
  READY_FOR_PICKUP: 'bg-blue-100 text-blue-800 dark:bg-blue-400/10 dark:text-blue-300',
  RENTED: 'bg-brand-forest/10 text-brand-forest',
  COMPLETED: 'bg-surface-strong text-ink-muted',
  RETURNED: 'bg-surface-strong text-ink-muted',
  OVERDUE_FOR_RETURN: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

function formatStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function BookingCard({ booking }: { booking: MyBookingRow }) {
  const statusStyle = STATUS_STYLES[booking.status] ?? 'bg-surface-strong text-ink-muted';
  const lineItems = [...(booking.packages ?? []), ...(booking.gears ?? [])];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint">Booking</p>
          <p className="font-semibold text-ink">#{booking.booking_number}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle}`}>
          {formatStatusLabel(booking.status)}
        </span>
      </div>

      <div className="grid gap-3 border-t border-line-soft pt-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint">Pickup</p>
          <p className="text-sm font-medium text-ink">{formatDateTime(booking.pickup_at)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint">Return</p>
          <p className="text-sm font-medium text-ink">{formatDateTime(booking.return_at)}</p>
        </div>
      </div>

      {lineItems.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-line-soft pt-3 text-sm text-ink-muted">
          {lineItems.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              {item.quantity > 1 ? `${item.quantity}x ` : ''}
              {item.name}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-line-soft pt-3 text-sm">
        <span className="text-ink-muted">
          Deposit <span className="font-semibold text-ink">{formatCurrency(booking.deposit_centavos / 100)}</span>
        </span>
        <span className="text-ink-muted">
          Rental Fee <span className="font-semibold text-ink">{formatCurrency(booking.rental_fee_centavos / 100)}</span>
        </span>
      </div>
    </div>
  );
}

export default function MyBookings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<FetchState>({ kind: 'loading' });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    let cancelled = false;
    supabase.rpc('get_my_bookings').then(({ data, error }) => {
      if (cancelled) return;

      if (error) {
        const notFound = error.code === 'PGRST202' || error.message.toLowerCase().includes('could not find the function');
        if (notFound) {
          setState({ kind: 'not_configured' });
        } else {
          console.error('[MyBookings] get_my_bookings failed:', error);
          setState({ kind: 'error', message: "We couldn't load your bookings right now. Please try again shortly." });
        }
        return;
      }

      setState({ kind: 'ready', bookings: (data as MyBookingRow[]) ?? [] });
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate, location.pathname]);

  if (authLoading || !user) return null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-ink">My Bookings</h1>
        <p className="text-sm text-ink-muted">Track the status of every rental you've booked with GearBNB.</p>
      </div>

      {state.kind === 'loading' && <p className="py-10 text-center text-sm text-ink-muted">Loading your bookings…</p>}

      {state.kind === 'not_configured' && (
        <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
          Booking history isn't available yet — check back soon!
        </p>
      )}

      {state.kind === 'error' && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {state.message}
        </p>
      )}

      {state.kind === 'ready' && state.bookings.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface-muted p-10 text-center">
          <p className="text-sm text-ink-muted">You haven't made any bookings yet.</p>
          <button
            type="button"
            onClick={() => navigate('/catalog')}
            className="rounded-lg bg-brand-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
          >
            Browse Gear
          </button>
        </div>
      )}

      {state.kind === 'ready' && state.bookings.length > 0 && (
        <div className="flex flex-col gap-4">
          {state.bookings.map((booking) => (
            <BookingCard key={booking.booking_id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}
