import { describe, expect, it } from 'vitest';
import { NUDGE_SNOOZE_MS, contactChannels, shouldShowCampsiteNudge } from './campsiteContact';

describe('contactChannels', () => {
  it('lists the ways the campsite can be contacted, in button order', () => {
    const channels = contactChannels({ facebookUrl: 'https://facebook.com/camp', phone: '0917 123 4567', websiteUrl: 'https://camp.example.com' });
    expect(channels.map((channel) => channel.channel)).toEqual(['FACEBOOK', 'PHONE', 'WEBSITE']);
    expect(channels[1]).toMatchObject({ label: 'Call', openLabel: 'Call 0917 123 4567', href: 'tel:09171234567', newTab: false, verb: 'call' });
    expect(channels[0]).toMatchObject({ label: 'Message on Facebook', newTab: true, verb: 'message them' });
  });

  it('leaves out what the campsite does not have', () => {
    expect(contactChannels({ facebookUrl: null, phone: '+63 917 000 0000', websiteUrl: null }).map((channel) => channel.href)).toEqual(['tel:+639170000000']);
    expect(contactChannels({ facebookUrl: null, phone: null, websiteUrl: null })).toEqual([]);
  });
});

describe('shouldShowCampsiteNudge', () => {
  const now = Date.UTC(2026, 10, 15);
  const base = { signedIn: false, views: 3, dismissedAt: null, now };

  it('shows after the third campsite for signed-out campers', () => {
    expect(shouldShowCampsiteNudge(base)).toBe(true);
    expect(shouldShowCampsiteNudge({ ...base, views: 2 })).toBe(false);
  });

  it('never shows to signed-in campers', () => {
    expect(shouldShowCampsiteNudge({ ...base, signedIn: true, views: 10 })).toBe(false);
  });

  it('stays away for a week after it is closed', () => {
    expect(shouldShowCampsiteNudge({ ...base, dismissedAt: now - NUDGE_SNOOZE_MS + 1 })).toBe(false);
    expect(shouldShowCampsiteNudge({ ...base, dismissedAt: now - NUDGE_SNOOZE_MS })).toBe(true);
  });
});
