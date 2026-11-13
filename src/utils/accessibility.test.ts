import { describe, expect, it } from 'vitest';
import { A11Y_DEFAULTS, isDefault, pageFilter, toggleProfile } from './accessibility';

describe('accessibility profiles', () => {
  it('turning a profile on switches on its adjustments, and off puts them back', () => {
    const on = toggleProfile(A11Y_DEFAULTS, 'seizure');
    expect(on).toMatchObject({ stopAnimations: true, saturation: 'low', profiles: ['seizure'] });
    const off = toggleProfile(on, 'seizure');
    expect(off).toMatchObject({ stopAnimations: false, saturation: 'default', profiles: [] });
    expect(isDefault(off)).toBe(true);
  });

  it('keeps an adjustment another active profile still wants', () => {
    const both = toggleProfile(toggleProfile(A11Y_DEFAULTS, 'seizure'), 'adhd');
    const seizureOff = toggleProfile(both, 'seizure');
    expect(seizureOff.stopAnimations).toBe(true); // ADHD Friendly still wants it
    expect(seizureOff.saturation).toBe('default');
    expect(seizureOff.readingMask).toBe(true);
  });
});

describe('pageFilter', () => {
  it('builds the page filter from contrast and saturation', () => {
    expect(pageFilter(A11Y_DEFAULTS)).toBe('');
    expect(pageFilter({ ...A11Y_DEFAULTS, contrast: 'dark' })).toBe('invert(1) hue-rotate(180deg)');
    expect(pageFilter({ ...A11Y_DEFAULTS, contrast: 'high', saturation: 'mono' })).toBe('contrast(1.4) grayscale(1)');
    expect(pageFilter({ ...A11Y_DEFAULTS, contrast: 'light', saturation: 'low' })).toBe('saturate(0.5)');
  });
});
