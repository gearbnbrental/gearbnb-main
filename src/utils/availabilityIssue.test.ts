import { describe, expect, it } from 'vitest';
import { describeAvailabilityIssue } from './availabilityIssue';

describe('describeAvailabilityIssue', () => {
  it('names the product and how many are left, keeping the color', () => {
    expect(describeAvailabilityIssue({ name: 'Mountainhiker King-Sized High Bed (40cm) (Black)', availableCount: 1 })).toBe(
      'Mountainhiker King-Sized High Bed (Black), only 1 available',
    );
  });
  it('shows the RMS add-on compatibility sentence as-is', () => {
    const name = '"Gazlite LPG Can" isn\'t a valid add-on for your selected gear.';
    expect(describeAvailabilityIssue({ name, availableCount: 0 })).toBe(name);
  });
});
