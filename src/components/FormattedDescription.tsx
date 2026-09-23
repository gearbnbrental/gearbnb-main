import { parseFormattedDescription } from '../utils/formattedDescription';

/**
 * Renders a Build Your Own gear kind's own RMS description with its real structure — bold
 * "Label:" specs, small-caps section headings, and a real checkmarked list under each one —
 * instead of one flat paragraph. See parseFormattedDescription's own doc comment for exactly what
 * shape it looks for; anything else renders as ordinary prose, unchanged from before this existed.
 */
export default function FormattedDescription({ text }: { text: string }) {
  const blocks = parseFormattedDescription(text);
  return (
    <div className="flex flex-col gap-1.5 text-sm text-ink-muted">
      {blocks.map((block, index) => {
        if (block.type === 'field') {
          return (
            <p key={index}>
              <span className="font-semibold text-ink">{block.label}:</span> {block.value}
            </p>
          );
        }
        if (block.type === 'heading') {
          return (
            <p key={index} className="pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {block.label}
            </p>
          );
        }
        if (block.type === 'checklist') {
          return (
            <ul key={index} className="flex flex-col gap-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0 font-semibold text-accent" aria-hidden="true">
                    ✓
                  </span>
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}
