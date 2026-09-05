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

/** Provisional start/return dates for a duration preset, starting from baseDateISO (defaults to today). */
export function getDurationRange(
  presetId: DurationPresetId,
  baseDateISO: string = new Date().toISOString().slice(0, 10),
): { startDate: string; returnDate: string } {
  const preset = DURATION_PRESETS.find((p) => p.id === presetId);
  const days = preset?.days ?? 1;

  const start = new Date(baseDateISO);
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  return { startDate: baseDateISO, returnDate: end.toISOString().slice(0, 10) };
}
