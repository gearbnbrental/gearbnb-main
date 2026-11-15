import { describe, expect, it } from 'vitest';
import { contactChannels } from './campsiteContact';
import { safeWebUrl } from './safeUrl';

describe('safeWebUrl', () => {
  it('keeps real web addresses', () => {
    expect(safeWebUrl('https://www.facebook.com/campsite')).toBe('https://www.facebook.com/campsite');
    expect(safeWebUrl('  http://camp.example.com/book ')).toBe('http://camp.example.com/book');
  });

  it('drops anything that is not a web address', () => {
    for (const value of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,hi', 'facebook.com/campsite', 'mailto:a@b.c', '', null, undefined]) {
      expect(safeWebUrl(value)).toBeNull();
    }
  });

  it('keeps unsafe links off the contact buttons', () => {
    const channels = contactChannels({ facebookUrl: 'javascript:alert(1)', phone: 'none', websiteUrl: 'https://camp.example.com' });
    expect(channels.map((channel) => channel.href)).toEqual(['https://camp.example.com/']);
  });
});
