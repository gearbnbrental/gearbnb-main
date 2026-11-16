import { describe, expect, it } from 'vitest';
import { SAMPLE_CAMPSITES } from '../data/campsiteSamples';
import type { Campsite } from '../types/campsite';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  bestSignal,
  bestSignalText,
  campsiteFacts,
  campsiteFaq,
  campsiteSummarySentence,
  driveTimeText,
  feeText,
  filterCampsites,
  filterOptions,
  filtersFromParams,
  filtersToParams,
  gearSuggestions,
  manilaToday,
  provinceFaq,
  provinceGroups,
  provinceIntro,
  provincePath,
  reviewErrors,
  sortReviews,
  type MustHave,
  type NetworkName,
} from './campsites';

const [riverside, mountain, lakeside, beach] = SAMPLE_CAMPSITES as [Campsite, Campsite, Campsite, Campsite];

describe('signal', () => {
  it('names the strongest network, and every network tied for it', () => {
    expect(bestSignal(riverside.details)).toEqual({ networks: ['Smart'], level: 'STRONG' });
    expect(bestSignalText(mountain.details)).toBe('Smart and Globe (strong)');
  });

  it('says so when no network has signal, and nothing when no network was checked', () => {
    expect(bestSignalText({ ...riverside.details, signalSmart: 'NONE', signalGlobe: 'NONE', signalDito: 'NONE' })).toBe(
      'No signal on any network',
    );
    expect(bestSignal(lakeside.details)).toBeNull();
  });
});

describe('wording', () => {
  it('formats fees, free entry and unknown fees', () => {
    expect(feeText(15000, 'PER_PERSON')).toBe('₱150 per person');
    expect(feeText(0, 'PER_PERSON')).toBe('Free');
    expect(feeText(null, 'PER_PERSON')).toBeNull();
  });

  it('rounds drive times to the half hour', () => {
    expect(driveTimeText(150)).toBe('about 2.5 hours');
    expect(driveTimeText(65)).toBe('about 1 hour');
    expect(driveTimeText(42)).toBe('about 40 minutes');
    expect(driveTimeText(null)).toBeNull();
  });

  it('builds an answer-style summary from confirmed details only', () => {
    expect(campsiteSummarySentence(riverside)).toBe(
      'Sample Riverside Campsite is a riverside and forest campsite in Tanay, Rizal, about 2.5 hours from Las Piñas. Entrance is ₱150 per person; there are restrooms and showers, Smart signal is strong and pets are allowed.',
    );
    expect(campsiteSummarySentence(lakeside)).toBe(
      'Sample Lakeside Glade is a lakeside campsite in Antipolo, Rizal, about 1.5 hours from Las Piñas. Entrance is free; there are restrooms and electricity.',
    );
  });

  it('keeps unconfirmed details in the facts as "Not confirmed yet"', () => {
    const facts = Object.fromEntries(campsiteFacts(beach).map((fact) => [fact.label, fact.value]));
    expect(facts.Restroom).toBe('No');
    expect(facts.Showers).toBe('Not confirmed yet');
    expect(facts['Best signal']).toBe('Smart and Globe (weak)');
  });
});

describe('auto-FAQ', () => {
  it('answers only what staff confirmed, and always says where to rent gear', () => {
    const questions = campsiteFaq(lakeside).map((item) => item.question);
    expect(questions).toContain('Is there a restroom at Sample Lakeside Glade?');
    expect(questions.some((question) => question.includes('signal'))).toBe(false);
    expect(questions[questions.length - 1]).toBe('Where can I rent camping gear for Sample Lakeside Glade?');
  });

  it('lists the signal on every checked network', () => {
    const signal = campsiteFaq(riverside).find((item) => item.question.includes('signal'));
    expect(signal?.answer).toBe('Smart has the best signal (strong). Smart / TNT: strong; Globe / TM / GOMO: weak; DITO: no signal.');
  });
});

describe('gear suggestions', () => {
  it('follows the campsite: no power means fans and lights, sand means sand pegs', () => {
    expect(gearSuggestions(mountain).map((item) => item.item)).toEqual(
      expect.arrayContaining(['Rechargeable fan and lights', 'A cooler', 'A shade canopy', 'A jacket']),
    );
    expect(gearSuggestions(beach).map((item) => item.item)).toContain('Sand pegs');
    expect(gearSuggestions(lakeside).map((item) => item.item)).not.toContain('Rechargeable fan and lights');
  });
});

describe('filters', () => {
  it('round-trips through the address bar, with several camping types and must-haves', () => {
    const filters = {
      ...EMPTY_FILTERS,
      query: 'river',
      province: 'Rizal',
      types: ['Riverside', 'Mountain'],
      mustHaves: ['restroom', 'pets'] as MustHave[],
      networks: ['Smart'] as NetworkName[],
      maxFee: 200,
    };
    const params = filtersToParams(filters);
    expect(params.toString()).toBe('q=river&province=Rizal&type=Riverside&type=Mountain&has=restroom&has=pets&signal=Smart&maxFee=200');
    expect(filtersFromParams(params)).toEqual(filters);
    expect(activeFilterCount(filters)).toBe(7);
  });

  it('ignores values it does not know', () => {
    expect(filtersFromParams(new URLSearchParams('signal=Sun&has=pool&maxFee=-3'))).toEqual(EMPTY_FILTERS);
  });

  it('matches any ticked camping type, and every must-have', () => {
    const names = (filters: Partial<typeof EMPTY_FILTERS>) =>
      filterCampsites(SAMPLE_CAMPSITES, { ...EMPTY_FILTERS, ...filters }).map((campsite) => campsite.name);
    expect(names({ types: ['Beach', 'Lakeside'] })).toEqual(['Sample Lakeside Glade', 'Sample Cove Beach Camp']);
    expect(names({ mustHaves: ['restroom'] })).toEqual(['Sample Riverside Campsite', 'Sample Mountain View Camp', 'Sample Lakeside Glade']);
    expect(names({ networks: ['Globe'] })).toEqual(['Sample Riverside Campsite', 'Sample Mountain View Camp', 'Sample Cove Beach Camp']);
    expect(names({ mustHaves: ['signal', 'bonfire'] })).toEqual(['Sample Riverside Campsite', 'Sample Mountain View Camp']);
    expect(names({ mustHaves: ['carCamping'] })).toEqual(['Sample Riverside Campsite']);
    expect(names({ mustHaves: ['motoCamping'] })).toEqual(['Sample Riverside Campsite', 'Sample Mountain View Camp']);
    expect(names({ mustHaves: ['nearManila', 'anyCar'] })).toEqual(['Sample Riverside Campsite']);
    expect(names({ maxFee: 100 })).toEqual(['Sample Mountain View Camp', 'Sample Lakeside Glade']);
    expect(names({ activity: 'stargazing', query: 'tanay' })).toEqual(['Sample Riverside Campsite', 'Sample Mountain View Camp']);
  });

  it('offers only options some campsite has, with counts', () => {
    expect(filterOptions(SAMPLE_CAMPSITES).provinces).toEqual([
      { label: 'Batangas', count: 1 },
      { label: 'Rizal', count: 3 },
    ]);
    expect(filterOptions(SAMPLE_CAMPSITES).types.map((option) => option.label)).toEqual(['Beach', 'Forest', 'Lakeside', 'Mountain', 'Riverside']);
  });
});

describe('provinces', () => {
  it('gives a province its own page only with at least 3 campsites', () => {
    expect(provinceGroups(SAMPLE_CAMPSITES).map((group) => group.province)).toEqual(['Batangas', 'Rizal']);
    const [rizal] = provinceGroups(SAMPLE_CAMPSITES, { withPagesOnly: true });
    expect(rizal?.campsites).toHaveLength(3);
    expect(provincePath('Rizal')).toBe('/campsites/province/rizal');
    expect(provinceIntro(rizal!)).toBe(
      '3 campsites in Rizal, from forest, lakeside and mountain spots, with the fees, signal, restrooms and rules checked by GearBnB. The nearest is about 1.5 hours from Las Piñas.',
    );
    expect(provinceFaq(rizal!).map((item) => item.question)).toContain('Which campsites in Rizal allow pets?');
  });
});

describe('reviews', () => {
  it('sorts by rating, newest first within a rating', () => {
    expect(sortReviews(riverside.reviews, 'lowest').map((review) => review.rating)).toEqual([4, 5]);
    expect(sortReviews(riverside.reviews, 'newest')[0]?.id).toBe('sample-review-1');
  });

  it('checks the same rules as the RMS', () => {
    const ok = { rating: 5, body: 'A lovely, quiet campsite by the river.', visitDate: '2026-11-01', photoPaths: [] };
    expect(reviewErrors(ok, '2026-11-14')).toEqual({});
    expect(Object.keys(reviewErrors({ rating: 0, body: 'Too short', visitDate: '2026-12-01', photoPaths: ['1', '2', '3', '4', '5', '6'] }, '2026-11-14'))).toEqual([
      'rating',
      'body',
      'photoPaths',
      'visitDate',
    ]);
    expect(reviewErrors({ ...ok, body: 'x'.repeat(2001) }, '2026-11-14').body).toBeDefined();
  });

  it("uses Manila's date", () => {
    expect(manilaToday(new Date('2026-11-13T17:30:00Z'))).toBe('2026-11-14');
  });
});
