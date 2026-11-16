import { describe, expect, it } from 'vitest';
import { SAMPLE_CAMPSITES } from '../data/campsiteSamples';
import { EMPTY_FILTERS, filterCampsites } from './campsites';
import { distanceKm, estimateDriveMinutes } from './travel';

const lasPinas = { name: 'Las Piñas City', lat: 14.446, lng: 120.997 };
const baguio = { name: 'Baguio City', lat: 16.402, lng: 120.596 };

describe('drive time estimate', () => {
  it('measures straight-line distance', () => {
    expect(Math.round(distanceKm(lasPinas, baguio))).toBe(222);
  });

  it('stretches it for roads at a typical speed, rounded to 5 minutes', () => {
    expect(estimateDriveMinutes(lasPinas, baguio)).toBe(450);
    expect(estimateDriveMinutes(lasPinas, lasPinas)).toBe(5);
  });

  it('powers "Within 3 hours from me", and ignores it without a location', () => {
    const near = (from: typeof lasPinas | null) =>
      filterCampsites(SAMPLE_CAMPSITES, { ...EMPTY_FILTERS, mustHaves: ['nearMe'] }, from).map((campsite) => campsite.name);
    expect(near(lasPinas)).toHaveLength(4);
    expect(near(baguio)).toEqual([]);
    expect(near(null)).toHaveLength(4);
  });
});
