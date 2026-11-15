/**
 * Contacting a campsite from its page: the buttons, the lead code the camper is asked to mention,
 * and the gentle sign-in nudge for campers browsing several campsites.
 */
import type { CampsiteLeadChannel } from '../types/campsite';

export interface ContactChannel {
  channel: CampsiteLeadChannel;
  /** The button on the campsite page. */
  label: string;
  /** The button that finally opens the campsite's page, app or dialer. */
  openLabel: string;
  /** "Mention it when you {verb}". */
  verb: string;
  href: string;
  /** Opens in a new tab (Facebook, the campsite's website); calls and texts don't. */
  newTab: boolean;
}

/** The ways to contact a campsite, in button order, for the ones it has. */
export function contactChannels(campsite: { facebookUrl: string | null; phone: string | null; websiteUrl: string | null }): ContactChannel[] {
  const channels: ContactChannel[] = [];
  if (campsite.facebookUrl) {
    channels.push({ channel: 'FACEBOOK', label: 'Message on Facebook', openLabel: 'Open their Facebook page', verb: 'message them', href: campsite.facebookUrl, newTab: true });
  }
  if (campsite.phone) {
    const number = campsite.phone.replace(/[^\d+]/g, '');
    channels.push({ channel: 'PHONE', label: 'Call', openLabel: `Call ${campsite.phone}`, verb: 'call', href: `tel:${number}`, newTab: false });
  }
  if (campsite.websiteUrl) {
    channels.push({ channel: 'WEBSITE', label: 'Website', openLabel: 'Open their website', verb: 'book', href: campsite.websiteUrl, newTab: true });
  }
  return channels;
}

/** Campsite pages viewed before the sign-in nudge shows. */
export const NUDGE_AFTER_VIEWS = 3;
/** How long a dismissed nudge stays away. */
export const NUDGE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** Whether a signed-out camper should see the sign-in nudge now. */
export function shouldShowCampsiteNudge({
  signedIn,
  views,
  dismissedAt,
  now,
}: {
  signedIn: boolean;
  views: number;
  dismissedAt: number | null;
  now: number;
}): boolean {
  if (signedIn || views < NUDGE_AFTER_VIEWS) return false;
  return dismissedAt === null || now - dismissedAt >= NUDGE_SNOOZE_MS;
}

const VIEWS_KEY = 'gearbnb-campsite-views';
const DISMISSED_KEY = 'gearbnb-campsite-nudge-dismissed-at';

/** Browser storage can be missing or blocked (private windows, previews): every read and write
 *  is wrapped, and the nudge simply doesn't show when it can't count. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not counted: the nudge stays hidden, which is fine.
  }
}

/** Counts one campsite page view (each campsite once) and returns how many campsites were viewed. */
export function countCampsiteView(slug: string): number {
  let viewed: string[] = [];
  try {
    const parsed: unknown = JSON.parse(read(VIEWS_KEY) ?? '[]');
    if (Array.isArray(parsed)) viewed = parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    viewed = [];
  }
  if (!viewed.includes(slug)) {
    viewed = [...viewed, slug].slice(-50);
    write(VIEWS_KEY, JSON.stringify(viewed));
  }
  return viewed.length;
}

export function nudgeDismissedAt(): number | null {
  const value = Number(read(DISMISSED_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function dismissNudge(now: number): void {
  write(DISMISSED_KEY, String(now));
}
