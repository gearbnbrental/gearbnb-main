/**
 * The app whose built-in browser this page is open in, if any (tapping a link inside Facebook,
 * Messenger, Instagram or TikTok opens it there, not in Safari or Chrome). Facebook and Google log
 * in often stall or are refused in these browsers, so the log-in page suggests opening the page in
 * the phone's own browser instead.
 */
export type InAppBrowser = 'Facebook' | 'Messenger' | 'Instagram' | 'TikTok';

export function inAppBrowserName(userAgent: string): InAppBrowser | null {
  // Messenger first: its user agent also carries Facebook's markers.
  if (/MessengerForiOS|MessengerLiteForiOS|Orca-Android|FB_IAB\/Orca/i.test(userAgent)) return 'Messenger';
  if (/Instagram/i.test(userAgent)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS|\[FB/i.test(userAgent)) return 'Facebook';
  if (/musical_ly|BytedanceWebview|TikTok/i.test(userAgent)) return 'TikTok';
  return null;
}
