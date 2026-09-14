import type { ComponentType } from 'react';
import { MESSENGER_URL, FACEBOOK_URL, TIKTOK_URL } from '../config/social';
import { ChatBubbleIcon, FacebookIcon, TikTokIcon } from './icons';

export type SocialPlatform = 'messenger' | 'facebook' | 'tiktok';

/**
 * Real, widely-recognized brand colors for each platform's icon badge (Messenger blue gradient,
 * Facebook blue, TikTok black) — matching the client's reference, which shows each platform as a
 * distinct colored circle rather than a monochrome icon. This is the ONE place that treatment is
 * defined; every CTA that wants a colored platform badge (as opposed to the site's existing
 * monochrome SocialLinks icons used in the Navbar/footer icon row) renders through here.
 */
const PLATFORM_CONFIG: Record<
  SocialPlatform,
  { label: string; href: string; icon: ComponentType<{ className?: string }>; badgeClassName: string }
> = {
  messenger: {
    label: 'Messenger',
    href: MESSENGER_URL,
    icon: ChatBubbleIcon,
    badgeClassName: 'bg-gradient-to-br from-[#00B2FF] to-[#006AFF] text-white',
  },
  facebook: {
    label: 'Facebook',
    href: FACEBOOK_URL,
    icon: FacebookIcon,
    badgeClassName: 'bg-[#1877F2] text-white',
  },
  tiktok: {
    label: 'TikTok',
    href: TIKTOK_URL,
    icon: TikTokIcon,
    badgeClassName: 'bg-ink text-white dark:bg-black',
  },
};

interface SocialIconLinkProps {
  platform: SocialPlatform;
  /** Shows the platform name under the badge (the homepage CTA's arrangement); omitted for a
   * denser row of icons alone (the "Still deciding?" banner, the footer). */
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function SocialIconLink({ platform, showLabel = false, size = 'md' }: SocialIconLinkProps) {
  const { label, href, icon: Icon, badgeClassName } = PLATFORM_CONFIG[platform];
  const badgeSize = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (opens in a new tab)`}
      className="group flex flex-col items-center gap-1.5"
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full shadow-sm transition-transform group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-brand-forest ${badgeSize} ${badgeClassName}`}
      >
        <Icon className={iconSize} />
      </span>
      {showLabel && <span className="text-xs font-medium text-ink-muted">{label}</span>}
    </a>
  );
}
