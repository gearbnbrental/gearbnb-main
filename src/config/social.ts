/**
 * The ONLY place the site's real social/contact destinations should be written — every CTA that
 * links to Messenger/Facebook/TikTok/email must import from here, never hardcode a URL inline.
 * These are the same, already-live destinations SocialLinks.tsx has used since before this file
 * existed; this just gives them names other components can import instead of duplicating them.
 */
export const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61583759100221';
export const INSTAGRAM_URL = 'https://www.instagram.com/gearbnb_rental';
export const TIKTOK_URL = 'https://www.tiktok.com/@camp.gearbnb';

/**
 * Client-confirmed Messenger destination — every "Messenger"/"Message Us"/"Need Help?" CTA in
 * this codebase must import this constant rather than hardcode the URL, so there is exactly one
 * place to change if it's ever updated again. (Previously this pointed at FACEBOOK_URL above as a
 * temporary stand-in while the real link wasn't yet available — that stand-in is gone now.)
 */
export const MESSENGER_URL = 'https://m.me/1053993614458909';

/**
 * Customer support contact email — client-confirmed. This is the ONLY email address the
 * customer-facing site shows or links to. It is deliberately NOT the same address the RMS uses
 * for automated booking emails (admin@gearbnbrental.com, sent server-side from the RMS — see that
 * project's own GMAIL_SENDER_EMAIL config, which this site never reads or touches). This site
 * sends no email itself; this constant is display/contact-only (a `mailto:` link).
 */
export const CONTACT_EMAIL: string | null = 'customersupport@gearbnbrental.com';
