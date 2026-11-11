/** "14:30" -> "2:30 in the afternoon": a plain-words check under the 24-hour time picker, with no
 *  AM/PM to misread. Takes the "HH:MM" string the checkout stores. */
export function describeTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const clock = `${hour % 12 || 12}:${String(minute).padStart(2, '0')}`;
  if (hour === 0 && minute === 0) return `${clock} midnight`;
  if (hour === 12 && minute === 0) return `${clock} noon`;
  if (hour < 5) return `${clock} after midnight`;
  if (hour < 12) return `${clock} in the morning`;
  if (hour < 18) return `${clock} in the afternoon`;
  if (hour < 21) return `${clock} in the evening`;
  return `${clock} at night`;
}
