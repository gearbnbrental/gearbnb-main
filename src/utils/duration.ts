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
