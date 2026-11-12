import { describe, expect, it } from 'vitest';
import { describeTime, formatDeadline } from './clockTime';

describe('describeTime', () => {
  it.each([
    ['00:00', '12:00 midnight'],
    ['00:30', '12:30 after midnight'],
    ['04:45', '4:45 after midnight'],
    ['05:00', '5:00 in the morning'],
    ['09:15', '9:15 in the morning'],
    ['12:00', '12:00 noon'],
    ['12:30', '12:30 in the afternoon'],
    ['14:30', '2:30 in the afternoon'],
    ['18:00', '6:00 in the evening'],
    ['21:00', '9:00 at night'],
    ['23:45', '11:45 at night'],
  ])('%s -> %s', (time, words) => {
    expect(describeTime(time)).toBe(words);
  });
});

describe('formatDeadline', () => {
  it('shows Manila time on the 24-hour clock with the time in words', () => {
    expect(formatDeadline(new Date('2026-11-13T07:00:00Z'))).toBe('Friday, November 13, 2026, 15:00 (3:00 in the afternoon)');
    expect(formatDeadline(new Date('2026-11-13T16:00:00Z'))).toBe('Saturday, November 14, 2026, 00:00 (12:00 midnight)');
  });
});
