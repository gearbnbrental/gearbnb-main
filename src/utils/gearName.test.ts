import { describe, expect, it } from 'vitest';
import { cleanGearName } from './gearName';

describe('cleanGearName', () => {
  it('drops the size and color tags', () => {
    expect(cleanGearName('Mountainhiker King-Sized High Bed (40cm) (Black)')).toBe('Mountainhiker King-Sized High Bed');
    expect(cleanGearName('Mountainhiker King-Sized Low Bed (20cm)')).toBe('Mountainhiker King-Sized Low Bed');
    expect(cleanGearName('Vidalido Vicore Villa Cabin Style (Khaki)')).toBe('Vidalido Vicore Villa Cabin Style');
  });
  it('leaves other names and other parentheses alone', () => {
    expect(cleanGearName('Naturehike Village 13 Lite')).toBe('Naturehike Village 13 Lite');
    expect(cleanGearName('Some Kit (Deluxe Edition)')).toBe('Some Kit (Deluxe Edition)');
  });
  it('keeps the color when asked, still dropping the size', () => {
    expect(cleanGearName('Mountainhiker King-Sized High Bed (40cm) (Black)', { keepColor: true })).toBe(
      'Mountainhiker King-Sized High Bed (Black)',
    );
  });
});
