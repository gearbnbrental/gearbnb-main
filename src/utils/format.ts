export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** A trip date ("2026-11-01") as "Nov 1, 2026", or null when empty or invalid. The value is a plain
 *  calendar date, parsed as UTC midnight and formatted in UTC so it never shifts a day. */
export function formatTripDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
