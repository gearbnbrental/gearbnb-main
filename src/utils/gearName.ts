const COLORS = 'black|khaki|white|grey|gray|green|blue|red|tan|brown|olive|orange|beige|yellow|pink|purple';
const SIZE_TAG = /\s*\(\d+(?:\.\d+)?\s*cm\)/gi;
const TRAILING_COLOR = new RegExp(`\\s*\\((?:${COLORS})\\)\\s*$`, 'i');

/**
 * The name a customer sees: drops the "(40cm)" height tag the RMS puts on some gear, and, unless
 * `keepColor` is set, the trailing "(Black)"/"(Khaki)" color tag too. "Mountainhiker King-Sized
 * High Bed (40cm) (Black)" becomes "Mountainhiker King-Sized High Bed", or with `keepColor`,
 * "Mountainhiker King-Sized High Bed (Black)". Use `keepColor` wherever two lines that differ only
 * by color must stay distinguishable (cart, checkout, bookings). Display only. Never use it for
 * matching or for anything sent to the RMS, which needs the full name.
 */
export function cleanGearName(name: string, options: { keepColor?: boolean } = {}): string {
  let result = name.replace(SIZE_TAG, '');
  if (!options.keepColor) {
    for (;;) {
      const next = result.replace(TRAILING_COLOR, '');
      if (next === result) break;
      result = next;
    }
  }
  return result.trim();
}
