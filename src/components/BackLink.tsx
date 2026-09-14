import { Link } from 'react-router-dom';
import { ChevronIcon } from './icons';

interface BackLinkProps {
  /** The logical parent page, always an explicit route — never `history.back()`, which would send
   *  the customer to whatever they happened to visit before (a deep link from email, a refresh, or
   *  an unrelated page) instead of the step they actually came from in this flow. */
  to: string;
  label: string;
}

/**
 * Back navigation to a named parent page. A plain <Link>, so it never unmounts anything the way a
 * full page load would: cart, booking and auth state all live in context/storage above the router,
 * and an in-app navigation leaves every one of them intact.
 */
export default function BackLink({ to, label }: BackLinkProps) {
  return (
    <Link
      to={to}
      className="inline-flex w-fit items-center gap-1 rounded-md py-1 text-sm font-medium text-ink-muted transition-colors hover:text-accent"
    >
      <ChevronIcon direction="left" className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
