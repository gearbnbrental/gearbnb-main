import { describe, expect, it } from 'vitest';
import { gearSpecificFaq } from './gearFaq';

describe('gearSpecificFaq (tents)', () => {
  it.each([
    ['Naturehike', 'Village 13 Lite', 5],
    ['Vidalido', 'Vicore Villa Cabin Style', 4],
    ['Blackdog', 'Pop-up Vinyl Tent', 5],
    ['Mobi Garden', 'Backpacking Tent', 5],
  ])('%s %s has %i extra entries', (brand, model, count) => {
    expect(gearSpecificFaq({ category: 'Tent', brand, model })?.entries).toHaveLength(count);
  });
  it('is undefined for non-tents and unknown tents', () => {
    expect(gearSpecificFaq({ category: 'Bed', brand: 'Naturehike', model: 'Village 13 Lite' })).toBeUndefined();
    expect(gearSpecificFaq({ category: 'Tent', brand: 'Other', model: 'X' })).toBeUndefined();
  });
});

describe('gearSpecificFaq (beds)', () => {
  it.each([
    ['Mountainhiker', 'King-Sized Low Bed (20cm)', 4],
    ['Mountainhiker', 'King-Sized High Bed (40cm)', 4],
    ['Mountainhiker', 'Single Bed', 4],
    ['Mobi Garden', 'Double-Sized Inflatable Bed', 4],
    ['Blackpongo', 'Double-Sized Inflatable Bed', 4],
  ])('%s %s has %i extra entries and its own capacity answer', (brand, model, count) => {
    const faq = gearSpecificFaq({ category: 'Bed', brand, model });
    expect(faq?.entries).toHaveLength(count);
    expect(faq?.capacityAnswer).toBeTruthy();
  });
});

describe('gearSpecificFaq (tables)', () => {
  it.each(['Small Table', 'Large Table', 'Extra-Long Table'])('%s has 3 entries, a serve question and its own capacity answer', (model) => {
    const faq = gearSpecificFaq({ category: 'Camping Table', brand: '', model });
    expect(faq?.entries).toHaveLength(3);
    expect(faq?.capacityQuestion).toContain('serve');
    expect(faq?.capacityAnswer).toBeTruthy();
  });
});

describe('gearSpecificFaq (chairs)', () => {
  it.each(['Ultra-light Chair', 'Kermit Chair', 'Moon Chair'])('%s has 3 entries and no capacity question', (model) => {
    const faq = gearSpecificFaq({ category: 'Camping Chair', brand: '', model });
    expect(faq?.entries).toHaveLength(3);
    expect(faq?.capacityAnswer).toBeUndefined();
  });
});

describe('gearSpecificFaq (lights)', () => {
  it.each([
    ['Blackdog', 'Strip Light'],
    ['Mountainhiker', 'Pinecone Lantern'],
    ['Orashare', 'Camping Light'],
  ])('%s %s has 4 entries and no capacity question', (brand, model) => {
    const faq = gearSpecificFaq({ category: 'Lights', brand, model });
    expect(faq?.entries).toHaveLength(4);
    expect(faq?.capacityAnswer).toBeUndefined();
  });
});

describe('gearSpecificFaq (coolers)', () => {
  it.each([
    ['Naturehike', '18L Cooler'],
    ['Blackdog', '17L Cooler'],
  ])('%s %s has 3 entries and no capacity question', (brand, model) => {
    const faq = gearSpecificFaq({ category: 'Cooler', brand, model });
    expect(faq?.entries).toHaveLength(3);
    expect(faq?.capacityAnswer).toBeUndefined();
  });
});

describe('gearSpecificFaq (fan)', () => {
  it('has 4 entries and no capacity question', () => {
    const faq = gearSpecificFaq({ category: 'Fan', brand: '', model: 'Tri-Pod Camping Fan' });
    expect(faq?.entries).toHaveLength(4);
    expect(faq?.capacityAnswer).toBeUndefined();
  });
});

describe('gearSpecificFaq (cooking set)', () => {
  it('has 3 entries and no capacity question', () => {
    const faq = gearSpecificFaq({ category: 'Cooking', brand: '', model: 'Big Cooking Set' });
    expect(faq?.entries).toHaveLength(3);
    expect(faq?.capacityAnswer).toBeUndefined();
  });
});

describe('gearSpecificFaq (stoves and gas)', () => {
  it.each([
    ['Gazlite', 'Portable Stove', 5],
    ['', 'Ultra-light Portable Stove', 4],
    ['Gazlite', 'LPG Can', 4],
  ])('%s %s has %i entries', (brand, model, count) => {
    expect(gearSpecificFaq({ category: 'Cooking', brand, model })?.entries).toHaveLength(count);
  });
});
