import { useId, useState, type ReactNode } from 'react';
import { ChevronDownIcon } from './icons';

export interface FaqItem {
  question: string;
  /** Plain text, or JSX when an answer needs a link. */
  answer: ReactNode;
}

/**
 * Accessible accordion — each question is a real `<button>` (never a clickable `<div>`) using the
 * standard `aria-expanded` + `aria-controls`/`id` pairing a screen reader already knows how to
 * announce, and `hidden` (not just a CSS class) on the collapsed answer so assistive tech and
 * Tab order both skip it while closed. Independent panels: opening one never closes another,
 * matching a plain FAQ list rather than a single-select "only one open at a time" pattern.
 */
function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="border-b border-line-soft last:border-b-0">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-4 py-4 text-left"
        >
          <span className="text-sm font-semibold text-ink sm:text-base">{item.question}</span>
          <ChevronDownIcon
            className={`h-4.5 w-4.5 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="pb-4 text-sm text-ink-muted">
        {item.answer}
      </div>
    </div>
  );
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface px-5 sm:px-6">
      {items.map((item) => (
        <FaqRow key={item.question} item={item} />
      ))}
    </div>
  );
}
