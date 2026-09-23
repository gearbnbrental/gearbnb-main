/**
 * Best-effort structure inside an otherwise plain-text gear description — presentation only, never
 * touches the underlying data. Staff often type specs as short "Label: value" lines, a bare
 * "Label:" line introducing a checklist, and checkmark-prefixed bullet lines under it, e.g.:
 *
 *   Capacity: 3 Person
 *   Weight: 2.5 kg
 *   Weather and Materials:
 *   ✓ Waterproof
 *   ✓ Sunproof
 *
 * This reads that shape line by line so FormattedDescription can bold the labels and turn the
 * checkmark lines into a real list, instead of one flat, boring paragraph. Anything that doesn't
 * match — ordinary prose — is left completely alone as its own paragraph, verbatim, exactly as
 * before this existed; this never drops or rewrites a word of the original text.
 */

export type DescriptionBlock =
  | { type: 'field'; label: string; value: string }
  | { type: 'heading'; label: string }
  | { type: 'checklist'; items: string[] }
  | { type: 'text'; text: string };

/** "Label: value" — a short label (letters/digits/spaces and a few punctuation marks, capped so a
 *  colon appearing deep inside an ordinary sentence is never mistaken for one) followed by real
 *  content on the same line. */
const FIELD_LINE_RE = /^([A-Za-z][A-Za-z0-9 /&()'-]{0,58}):\s*(.+)$/;

/** The same label shape, but with nothing after the colon — a section heading for the checklist
 *  lines that follow it (e.g. "Weather and Materials:"). */
const HEADING_LINE_RE = /^([A-Za-z][A-Za-z0-9 /&()'-]{0,58}):\s*$/;

/** A checkmark or bullet-prefixed line — staff use "✓" in practice, but "•"/"-"/"*" are accepted
 *  too so a different bullet character never falls back to looking like a stray field/heading. */
const BULLET_LINE_RE = /^[✓✔•*-]\s*(.+)$/;

export function parseFormattedDescription(description: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let checklist: string[] | null = null;
  let textLines: string[] | null = null;

  const flushChecklist = () => {
    if (checklist && checklist.length > 0) blocks.push({ type: 'checklist', items: checklist });
    checklist = null;
  };
  const flushText = () => {
    if (textLines && textLines.length > 0) blocks.push({ type: 'text', text: textLines.join(' ') });
    textLines = null;
  };

  for (const rawLine of description.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flushChecklist();
      flushText();
      continue;
    }

    const bulletMatch = line.match(BULLET_LINE_RE);
    if (bulletMatch) {
      flushText();
      checklist ??= [];
      checklist.push(bulletMatch[1].trim());
      continue;
    }

    const fieldMatch = line.match(FIELD_LINE_RE);
    if (fieldMatch) {
      flushChecklist();
      flushText();
      blocks.push({ type: 'field', label: fieldMatch[1].trim(), value: fieldMatch[2].trim() });
      continue;
    }

    const headingMatch = line.match(HEADING_LINE_RE);
    if (headingMatch) {
      flushChecklist();
      flushText();
      blocks.push({ type: 'heading', label: headingMatch[1].trim() });
      continue;
    }

    // Ordinary prose — accumulated so a sentence someone manually wrapped across lines renders as
    // one paragraph, not one paragraph per line.
    flushChecklist();
    textLines ??= [];
    textLines.push(line);
  }
  flushChecklist();
  flushText();
  return blocks;
}
