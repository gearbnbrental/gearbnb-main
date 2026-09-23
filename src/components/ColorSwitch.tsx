/** Swatch shown beside a color name. A color not listed just shows its name without one. */
const COLOR_SWATCHES: Record<string, string> = {
  black: '#1c1c1c',
  khaki: '#b8a77a',
};

interface ColorSwitchProps {
  /** Display names of the colors on offer, e.g. ['Black', 'Khaki']. */
  colors: string[];
  active: string;
  onChange: (color: string) => void;
}

/**
 * One page-wide color switch (Black/Khaki) shared by the Build Your Own and Packages pages, so a
 * color is picked once for the whole page instead of on every product. A segmented control: one
 * rounded track with an equal-width segment per color, the chosen one raised on a white "thumb"
 * with a forest-green outline. Full width on phones (two big tap targets), a compact inline pair
 * from `sm` up.
 */
export default function ColorSwitch({ colors, active, onChange }: ColorSwitchProps) {
  return (
    <div role="radiogroup" aria-label="Filter by color" className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted sm:text-xs">Choose a color</span>
      <div className="flex w-full gap-1 rounded-xl border border-line bg-surface-strong p-1 sm:inline-flex sm:w-fit">
        {colors.map((color) => {
          const swatch = COLOR_SWATCHES[color.toLowerCase()];
          const isActive = active === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(color)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all sm:flex-none sm:px-7 ${
                isActive
                  ? 'bg-surface text-ink shadow-sm ring-2 ring-brand-forest'
                  : 'text-ink-muted hover:bg-surface/60 hover:text-ink'
              }`}
            >
              {swatch && (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/25 ring-offset-1 ring-offset-transparent"
                  style={{ backgroundColor: swatch }}
                />
              )}
              {color}
            </button>
          );
        })}
      </div>
    </div>
  );
}
