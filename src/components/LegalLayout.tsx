import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDownIcon } from './icons';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Clears the sticky site header (Navbar) so a jumped-to heading never sits underneath it. */
const HEADER_OFFSET_PX = 112;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  // Keeps the address bar shareable ("…/privacy-policy#rights") without adding a history entry per
  // click, which would make the browser Back button step through every section the reader visited.
  window.history.replaceState(null, '', `#${id}`);
}

/**
 * Shared shell for GearBnB's long-form legal pages (Terms of Service, Privacy Policy): title block,
 * numbered contents index, numbered sections, a hover-reveal "On this page" rail beside the text on
 * wide screens, and a compact "reading dock" on narrower ones. Purely presentational — every word
 * of the policy itself lives in the page that renders this, never here.
 */
export default function LegalLayout({
  title,
  updated,
  lead,
  sections,
}: {
  title: string;
  updated: string;
  lead: ReactNode;
  sections: LegalSection[];
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '');
  const [dockOpen, setDockOpen] = useState(false);

  // Scrollspy: the active section is the last heading that has crossed a line a little below the
  // header. rAF-throttled so a fast scroll never queues a layout read per event.
  useEffect(() => {
    let ticking = false;

    function update() {
      ticking = false;
      const line = HEADER_OFFSET_PX + Math.max(80, (window.innerHeight - HEADER_OFFSET_PX) * 0.3);
      let current = sections[0]?.id ?? '';
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= line) current = section.id;
        else break;
      }
      setActiveId(current);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sections]);

  // A direct visit to "…#rights" (or a footer deep link) gets no native scroll-to-fragment from
  // React Router the way a full page load would, so this reproduces it once on mount.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) requestAnimationFrame(() => scrollToSection(decodeURIComponent(hash)));
  }, []);

  useEffect(() => {
    if (!dockOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDockOpen(false);
    }
    function onPointerDown(event: MouseEvent) {
      if (!(event.target as Element).closest('[data-legal-dock]')) setDockOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [dockOpen]);

  function handleJump(event: React.MouseEvent, id: string) {
    event.preventDefault();
    scrollToSection(id);
    setActiveId(id);
    setDockOpen(false);
  }

  const activeTitle = sections.find((s) => s.id === activeId)?.title ?? '';

  return (
    <main className="mx-auto w-full max-w-[70rem] px-5 pb-32 pt-12 sm:px-6 sm:pt-14">
      <div className="md:pl-16 xl:grid xl:grid-cols-[minmax(0,42rem)_minmax(14rem,1fr)] xl:gap-x-14 print:block print:pl-0">
        <div className="min-w-0">
          <header className="flex flex-col gap-4">
            <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">{title}</h1>
            <p className="text-sm font-medium text-ink-faint">Last updated: {updated}</p>
            <p className="max-w-2xl text-base leading-8 text-ink-muted sm:text-lg">{lead}</p>
          </header>

          <nav aria-label="Contents" className="mt-12 max-w-2xl print:hidden">
            <p className="mb-2 text-sm font-semibold text-ink">Contents</p>
            <ol className="border-b border-line md:columns-2 md:gap-10 md:border-b-0">
              {sections.map((section, index) => (
                <li key={section.id} className="break-inside-avoid">
                  <a
                    href={`#${section.id}`}
                    onClick={(event) => handleJump(event, section.id)}
                    className="grid grid-cols-[2.25rem_1fr] items-baseline border-t border-line py-2 text-base leading-snug text-ink-muted transition-colors hover:text-accent"
                  >
                    <span className="font-semibold tabular-nums text-ink">{index + 1}</span>
                    <span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-4">
            {sections.map((section, index) => (
              <section key={section.id} className="mt-16">
                <h2
                  id={section.id}
                  className="relative mb-4 scroll-mt-28 text-lg font-semibold leading-snug text-ink sm:text-xl"
                >
                  <span className="mr-2 tabular-nums text-ink md:absolute md:-left-16 md:mr-0 md:w-12 md:text-right print:static print:mr-2 print:w-auto">
                    {index + 1}
                  </span>
                  {section.title}
                </h2>
                <div className="flex flex-col gap-4 text-base leading-8 text-ink-muted sm:text-lg">{section.body}</div>
              </section>
            ))}
          </div>
        </div>

        {/* Wide screens: the full list is always visible beside the text; only the section being read
            turns green. */}
        <nav aria-label="On this page" className="sticky top-28 mt-1.5 hidden self-start text-[0.8125rem] xl:block print:hidden">
          <p className="mb-3.5 font-semibold text-ink">On this page</p>
          <ol>
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  onClick={(event) => handleJump(event, section.id)}
                  aria-current={section.id === activeId ? 'location' : undefined}
                  title={section.title}
                  className="group/item flex h-7 items-center text-ink-muted transition-colors hover:text-ink aria-[current=location]:font-semibold aria-[current=location]:text-accent"
                >
                  <span className="flex w-[1.6rem] flex-none items-center">
                    <span className="block h-0.5 w-2.5 rounded bg-line transition-all group-hover/item:bg-accent group-aria-[current=location]/item:w-5 group-aria-[current=location]/item:bg-accent" />
                  </span>
                  <span className="w-[1.5rem] flex-none tabular-nums">{index + 1}</span>
                  <span className="min-w-0 truncate">{section.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Narrower screens: a fixed dock that always says where you are and opens the same list. Its
          right edge stops short of the site's bottom-right Help / Back-to-top buttons. */}
      <nav
        aria-label="On this page"
        data-legal-dock
        className="fixed bottom-4 left-4 right-24 z-30 max-w-sm text-sm xl:hidden print:hidden"
      >
        {dockOpen && (
          <div
            id="legal-dock-panel"
            className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 max-h-[min(60vh,26rem)] overflow-auto rounded-xl border border-line bg-surface px-4 py-1.5 shadow-xl"
          >
            <ol>
              {sections.map((section, index) => (
                <li key={section.id} className="border-b border-line last:border-b-0">
                  <a
                    href={`#${section.id}`}
                    onClick={(event) => handleJump(event, section.id)}
                    aria-current={section.id === activeId ? 'location' : undefined}
                    className="grid grid-cols-[2rem_1fr] py-2 text-ink-muted aria-[current=location]:font-semibold aria-[current=location]:text-accent"
                  >
                    <span className="font-semibold tabular-nums">{index + 1}</span>
                    <span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
        <button
          type="button"
          onClick={() => setDockOpen((prev) => !prev)}
          aria-expanded={dockOpen}
          aria-controls="legal-dock-panel"
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-ink shadow-md"
        >
          <span className="flex-none font-semibold">On this page</span>
          <span className="min-w-0 flex-1 truncate font-medium text-accent">{activeTitle}</span>
          <ChevronDownIcon className={`h-4 w-4 flex-none transition-transform ${dockOpen ? '' : 'rotate-180'}`} />
        </button>
      </nav>
    </main>
  );
}

/* Small typographic building blocks so each policy page is just content, not class strings. */

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-3 pl-6 marker:text-accent">{children}</ul>;
}

export function LegalSteps({ children }: { children: ReactNode }) {
  return <ol className="flex list-decimal flex-col gap-3 pl-6 marker:font-semibold marker:text-ink">{children}</ol>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

export const legalLinkClass = 'font-medium text-accent underline underline-offset-4 hover:decoration-2';

export function LegalContact({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="border-t border-line">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-x-4 border-b border-line py-3 sm:grid-cols-[12rem_1fr]">
          <dt className="font-semibold text-ink">{row.label}</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
