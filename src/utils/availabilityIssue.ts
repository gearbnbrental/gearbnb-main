import { cleanGearName } from './gearName';

/** One line of customer-facing text for an availability issue. Most issues are a product name plus
 *  how many are left. The RMS's "isn't a valid add-on for your selected gear" issue is already a
 *  full sentence (its counts are always 0), so it's shown as-is instead of getting ", only 0
 *  available" stuck on the end. */
export function describeAvailabilityIssue(issue: { name: string; availableCount: number }): string {
  if (/isn't a valid add-on/i.test(issue.name)) return issue.name;
  return `${cleanGearName(issue.name, { keepColor: true })}, only ${issue.availableCount} available`;
}
