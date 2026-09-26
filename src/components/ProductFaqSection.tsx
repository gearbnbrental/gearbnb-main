import { useState } from 'react';
import type { BookableGearKind } from '../types/gearbnb';
import type { FaqLinkTarget } from '../utils/faqLinks';
import type { FaqEntry } from '../utils/productFaq';
import { faqPageJsonLd } from '../utils/productFaq';

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function AnswerWithLinks({
  answer,
  linkTargets,
  onOpenKind,
}: {
  answer: string;
  linkTargets: FaqLinkTarget[];
  onOpenKind?: (kind: BookableGearKind) => void;
}) {
  if (!onOpenKind || linkTargets.length === 0) return <>{answer}</>;
  const pattern = new RegExp(`(${linkTargets.map((t) => t.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
  return (
    <>
      {answer.split(pattern).map((part, index) => {
        const target = linkTargets.find((t) => t.text === part);
        return target ? (
          <span
            key={index}
            role="link"
            tabIndex={0}
            onClick={() => onOpenKind(target.kind)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenKind(target.kind);
              }
            }}
            className="cursor-pointer text-accent underline underline-offset-2 hover:text-brand-forest-dark"
          >
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
}

function FaqRow({
  entry,
  linkTargets,
  onOpenKind,
}: {
  entry: FaqEntry;
  linkTargets: FaqLinkTarget[];
  onOpenKind?: (kind: BookableGearKind) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line-soft last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
      >
        <span className="text-sm font-medium text-ink">{entry.question}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <p className="whitespace-pre-line pb-2.5 text-sm text-ink-muted">
          <AnswerWithLinks answer={entry.answer} linkTargets={linkTargets} onOpenKind={onOpenKind} />
        </p>
      )}
    </div>
  );
}

/**
 * "Frequently Asked Questions" block shared by the gear and package details popups (see
 * GearDetailsDialog/PackageDetailsDialog) — real, visible tap-to-expand content for whoever opened
 * the popup, plus the same content again as FAQPage JSON-LD. See that JSON-LD helper's own doc
 * comment for why it has no real search-visibility payoff as things stand (this popup has no URL
 * of its own for Google to credit it to).
 */
export default function ProductFaqSection({
  entries,
  linkTargets = [],
  onOpenKind,
}: {
  entries: FaqEntry[];
  /** Product names to turn into links wherever an answer mentions them. */
  linkTargets?: FaqLinkTarget[];
  onOpenKind?: (kind: BookableGearKind) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-accent/30 bg-accent/5 dark:bg-accent/10">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(entries)) }}
      />
      <p className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-accent">Frequently Asked Questions</p>
      <div className="px-3 pb-1">
        {entries.map((entry) => (
          <FaqRow key={entry.question} entry={entry} linkTargets={linkTargets} onOpenKind={onOpenKind} />
        ))}
      </div>
    </div>
  );
}
