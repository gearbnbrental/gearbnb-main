export const SOCIAL_LINKS: { label: string; href: string; path: string }[] = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61583759100221',
    path: 'M14 8.5h2.5V5.5H14c-2.2 0-4 1.8-4 4v2H7.5v3H10V19h3v-4.5h2.5l.5-3H13v-2c0-.55.45-1 1-1Z',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/gearbnb_rental',
    path: 'M8 4.5h8A3.5 3.5 0 0 1 19.5 8v8a3.5 3.5 0 0 1-3.5 3.5H8A3.5 3.5 0 0 1 4.5 16V8A3.5 3.5 0 0 1 8 4.5Zm4 3.75A3.75 3.75 0 1 0 15.75 12 3.75 3.75 0 0 0 12 8.25Zm4.4-1.1a.9.9 0 1 0 .9.9.9.9 0 0 0-.9-.9Z',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@camp.gearbnb',
    path: 'M15.5 4.5h-2.3v10.4a2.1 2.1 0 1 1-1.7-2.06V10.5a4.2 4.2 0 1 0 4 4.2V9.4a5.5 5.5 0 0 0 3.2 1V8.1a3.2 3.2 0 0 1-3.2-3.2v-.4Z',
  },
];

export default function SocialLinks({ className }: { className?: string }) {
  return (
    <>
      {SOCIAL_LINKS.map((social) => (
        <a
          key={social.label}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={social.label}
          className={className}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d={social.path} />
          </svg>
        </a>
      ))}
    </>
  );
}
