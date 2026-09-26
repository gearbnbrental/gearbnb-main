import type { DurationPresetId } from '../types/gearbnb';

interface DurationPreset {
  id: DurationPresetId;
  label: string;
  days: number;
}

export const DURATION_PRESETS: DurationPreset[] = [
  { id: '24h', label: '24 Hours', days: 1 },
  { id: '48h', label: '48 Hours', days: 2 },
  { id: '72h', label: '72 Hours', days: 3 },
];

/** Client rule: there is no 24-hour rental tier for either a Package or a Build Your Own booking
 *  — both PathACatalog and PathBCatalog filter down to this same pair, so it's kept here once as
 *  the single source of truth for "which presets a customer can actually pick" rather than two
 *  independently-filtered copies that could drift apart. */
/**
 * GearBnB's business timezone. The Philippines is fixed at UTC+8 with no DST, and the RMS already
 * treats Asia/Manila as its business timezone (see the RMS's src/lib/dates.ts, MANILA_OFFSET_MS).
 * Rental dates/times the customer picks are Manila wall-clock times, whatever timezone their
 * browser happens to be set to.
 */
export const BUSINESS_TIME_ZONE = 'Asia/Manila';
const BUSINESS_UTC_OFFSET = '+08:00';

type BookableDurationPresetId =Extract<DurationPresetId, '48h' | '72h'>;
const BOOKABLE_DURATION_PRESETS = DURATION_PRESETS.filter(
  (preset): preset is { id: BookableDurationPresetId; label: string; days: number } => preset.id !== '24h',
);

/**
 * Earliest selectable rental start, as the customer's OWN calendar day. Deliberately not
 * `new Date().toISOString().slice(0,10)`: that is the UTC day, which in the Philippines (UTC+8)
 * is still yesterday for the first 8 hours of every local day — as a `min` that would quietly let
 * a customer pick a start date already in the past. Shared by both PathACatalog and PathBCatalog.
 */
export function localTodayISO(): string {
  // en-CA formats as yyyy-mm-dd. Anchored to the business timezone (not the browser's) so the
  // earliest selectable day matches the Manila calendar day RMS itself uses.
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(new Date());
}

/**
 * Latest rental date a customer can pick. The RMS refuses dates more than a year out, so this stays
 * a few days inside that, and a customer isn't let to choose a date the availability check and the
 * booking would both bounce.
 */
export function latestBookableDateISO(fromISO: string = localTodayISO()): string {
  const day = new Date(`${fromISO}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 360);
  return day.toISOString().slice(0, 10);
}

/** Trip dates restored from an earlier visit that have since passed. The RMS rejects past dates, so
 *  keeping them would leave the availability check failing with no explanation the customer could
 *  act on. Clears both dates (the rest of the trip details are kept) so they simply pick again. */
export function dropStaleTripDates<T extends { startDate: string; returnDate: string }>(details: T, today: string = localTodayISO()): T {
  return details.startDate && details.startDate < today ? { ...details, startDate: '', returnDate: '' } : details;
}

/** Computed once at module load, same as every existing caller expected of its own local copy —
 *  "today" doesn't need to be re-read per render on either catalog page. */
export const TODAY = localTodayISO();

/** The latest date a date picker should offer, see latestBookableDateISO. */
export const MAX_BOOKING_DATE = latestBookableDateISO();

/** Which duration preset a saved start/return pair represents, or null if it matches none.
 *  Restores a duration picker's selection when a customer returns to a page with dates already in
 *  their cart — the dates persist in shared cart state, so the duration shown above them must too,
 *  rather than resetting to "select a duration" while populated dates sit below it. Shared by both
 *  PathACatalog (packages) and PathBCatalog (Build Your Own) — the day-count math has nothing
 *  package- or BYO-specific about it. */
export function durationFromDates(startDate: string, returnDate: string): BookableDurationPresetId | null {
  if (!startDate || !returnDate) return null;
  const start = new Date(startDate);
  const end = new Date(returnDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  // Anything past the 72h preset's 3 days is still "72h" plus extra days on top (see
  // extraDaysFromDates) — never a preset of its own.
  if (days > 3) return '72h';
  return BOOKABLE_DURATION_PRESETS.find((preset) => preset.days === days)?.id ?? null;
}

/** Same idea as durationFromDates, but for the "want to rent longer?" extra-days count that sits
 *  on top of the 72h preset — a saved N-day range (N > 3) restores as 72h + (N-3) extra days
 *  instead of matching no preset at all and losing the customer's selection on return. Returns 0
 *  for anything that isn't a 72h-or-longer range (48h has no extra-days concept). Shared for the
 *  same reason as durationFromDates above. */
export function extraDaysFromDates(startDate: string, returnDate: string): number {
  if (!startDate || !returnDate) return 0;
  const start = new Date(startDate);
  const end = new Date(returnDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return days > 3 ? days - 3 : 0;
}

/**
 * Promotional badge text per duration tier (e.g. "72hrs is the Best Deal"). Client rule: don't
 * hardcode this into components if it can be configured through the database — this is kept as
 * one named export precisely so a future DB-backed config only has to replace this object, not
 * every place a duration badge is rendered. Pending a real `promoLabel`-style column on the
 * admin side, this is the mock/interim source of truth.
 */
export const DURATION_PROMO_BADGES: Partial<Record<DurationPresetId, string>> = {
  '72h': '🔥 Best Deal',
};

/**
 * The extra cost of upgrading from 48h to 72h for a given kit/item, computed from its own real
 * pricing tiers rather than a hardcoded flat amount (the client's "Add ₱500 to rent for 72hrs"
 * copy was illustrative, not a universal constant — the actual delta varies per product).
 */
export function getSeventyTwoHourUpsellDelta(pricing: { '48h': number; '72h': number }): number {
  return pricing['72h'] - pricing['48h'];
}

/**
 * Combines a yyyy-mm-dd date and an "HH:MM" time into an ISO timestamp, or null if the date is
 * missing/invalid, or the time is missing/invalid. This is the one, single construction the final
 * booking submission uses for pickupAt/returnAt (see PaymentBreakdown.tsx's own performSubmit and
 * validateAndConfirm) — shared here so nothing else in the app can independently reinvent it and
 * drift out of sync. Strict on purpose: an empty `timeStr` returning null is what lets
 * validateAndConfirm's own "please fill in your preferred time" check keep working.
 */
export function toTimestamp(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  // Explicit Manila offset — without it the string is parsed in the BROWSER's timezone, so the same
  // "10:00 AM" would become a different instant for a customer whose device isn't set to Manila.
  const date = new Date(`${dateStr}T${timeStr}:00${BUSINESS_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Same construction as toTimestamp above, but falls back to midnight local time when no
 * preferred time has been chosen yet — for the advisory availability checks that run before the
 * customer ever reaches Trip Details, where `preferredTime` is actually set (PathACatalog/
 * PathBCatalog check availability the moment dates are picked; PaymentBreakdown's own background
 * check can also run before Preferred Time is filled in). Once a real preferred time exists in
 * the cart, this produces the exact same timestamp toTimestamp would for the real booking
 * submission — the midnight fallback only ever applies while there is genuinely no real time yet
 * to match. Never used for the final booking submission itself, or for the fresh submit-time
 * availability check in validateAndConfirm — both of those use the strict toTimestamp above,
 * since a preferred time is already guaranteed to exist by the point either one runs.
 */
export function toAvailabilityTimestamp(dateStr: string, timeStr: string): string | null {
  return toTimestamp(dateStr, timeStr || '00:00');
}

/**
 * Provisional start/return dates for a duration preset, starting from baseDateISO (defaults to
 * today). `extraDays` (default 0) adds whole days beyond the preset — e.g. the 72h preset plus
 * `extraDays: 2` returns a 5-day range — for the Package Catalog's "want to rent longer?" control;
 * every existing caller that doesn't pass it keeps its exact original 48h/72h-only behavior.
 *
 * Timezone note: `baseDateISO` is a plain calendar-date string (never "now"), so parsing it with
 * `new Date(...)` anchors to UTC midnight for that date — adding whole days and reading the result
 * back via `toISOString` stays correct for every timezone because a "day" is added in the same UTC
 * frame it started in. This is NOT the same pitfall as computing "today" from `new Date()` directly
 * (see PathACatalog's own `localTodayISO`), which depends on the current instant and does need
 * local-time handling instead.
 */
export function getDurationRange(
  presetId: DurationPresetId,
  baseDateISO: string = new Date().toISOString().slice(0, 10),
  extraDays: number = 0,
): { startDate: string; returnDate: string } {
  const preset = DURATION_PRESETS.find((p) => p.id === presetId);
  const days = (preset?.days ?? 1) + extraDays;

  const start = new Date(baseDateISO);
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  return { startDate: baseDateISO, returnDate: end.toISOString().slice(0, 10) };
}
