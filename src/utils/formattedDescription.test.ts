import { describe, expect, it } from 'vitest';
import { parseFormattedDescription } from './formattedDescription';

describe('parseFormattedDescription', () => {
  it('parses fields, headings and checklists from a real spec-style description', () => {
    const description = [
      'Capacity: 3 Person',
      'Weight: 2.5 kg',
      'Color: Black',
      'Weather and Materials:',
      '✓ Waterproof',
      '✓ Sunproof',
      '✓ Light and strong aluminum materials',
      'Vehicle fit:',
      '✓ Motorcycle compartment, bag, or strapped behind the seat',
      '✓ All types of cars',
      '✓ Backpacking',
    ].join('\n');

    expect(parseFormattedDescription(description)).toEqual([
      { type: 'field', label: 'Capacity', value: '3 Person' },
      { type: 'field', label: 'Weight', value: '2.5 kg' },
      { type: 'field', label: 'Color', value: 'Black' },
      { type: 'heading', label: 'Weather and Materials' },
      { type: 'checklist', items: ['Waterproof', 'Sunproof', 'Light and strong aluminum materials'] },
      { type: 'heading', label: 'Vehicle fit' },
      {
        type: 'checklist',
        items: ['Motorcycle compartment, bag, or strapped behind the seat', 'All types of cars', 'Backpacking'],
      },
    ]);
  });

  it('matches the real Naturehike Village 13 Lite description already live on the RMS', () => {
    const description = 'Size: 395x270x183 cm EzCamp\nStorage Size: 110x25x25 cm\nWeight: 18.5kg';
    expect(parseFormattedDescription(description)).toEqual([
      { type: 'field', label: 'Size', value: '395x270x183 cm EzCamp' },
      { type: 'field', label: 'Storage Size', value: '110x25x25 cm' },
      { type: 'field', label: 'Weight', value: '18.5kg' },
    ]);
  });

  it('leaves ordinary prose with no label/checklist shape completely alone', () => {
    expect(parseFormattedDescription('A cozy 2-person camping tent, easy to set up.')).toEqual([
      { type: 'text', text: 'A cozy 2-person camping tent, easy to set up.' },
    ]);
  });

  it('joins a manually line-wrapped sentence into one paragraph', () => {
    expect(parseFormattedDescription('A cozy tent\nthat is easy to set up.')).toEqual([
      { type: 'text', text: 'A cozy tent that is easy to set up.' },
    ]);
  });

  it('accepts •, - and * as bullet markers, not only ✓', () => {
    expect(parseFormattedDescription('Includes:\n• Groundsheet\n- Repair kit\n* Stakes')).toEqual([
      { type: 'heading', label: 'Includes' },
      { type: 'checklist', items: ['Groundsheet', 'Repair kit', 'Stakes'] },
    ]);
  });

  it('starts a fresh checklist block after a blank line, even under the same heading', () => {
    expect(parseFormattedDescription('✓ First\n✓ Second\n\n✓ Third')).toEqual([
      { type: 'checklist', items: ['First', 'Second'] },
      { type: 'checklist', items: ['Third'] },
    ]);
  });

  it('never mistakes a long sentence for a label', () => {
    const longSentence = 'This is an ordinary sentence that happens to run on for quite a long while before it ever reaches a colon: like this.';
    expect(parseFormattedDescription(longSentence)).toEqual([{ type: 'text', text: longSentence }]);
  });
});
