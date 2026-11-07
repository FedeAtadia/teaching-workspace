"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setPalette } from "@/i18n/actions";
import { PALETTES, type Palette } from "@/lib/theme";

/** Three dots that preview each theme in the picker: its deep, main and light colour. */
const SWATCHES: Record<Palette, [string, string, string]> = {
  teal: ["#006d77", "#2ec4b6", "#64dfdf"],
  terracota: ["#b8532e", "#e07a5f", "#f4a261"],
  malva: ["#6e58a0", "#b794f4", "#d6bcfa"],
  pizarra: ["#2b4255", "#3e5c76", "#7ea8ce"],
};

/** THEME-3: Teal nórdico / Terracota / Malva / Pizarra, as chips with a preview of each. */
export function PaletteSelect({ current, labels }: { current: Palette; labels: Record<Palette, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {PALETTES.map((palette) => (
        <button
          key={palette}
          type="button"
          role="radio"
          aria-checked={current === palette}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setPalette(palette);
              // data-palette on <html> is set by the server (THEME-3), so re-render.
              router.refresh();
            })
          }
          className="flex h-11 items-center gap-2.5 rounded-full bg-muted py-1 pr-4 pl-3 text-sm font-semibold text-muted-foreground ring-1 ring-border transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-checked:bg-card aria-checked:text-foreground aria-checked:ring-2 aria-checked:ring-foreground"
        >
          <span className="flex" aria-hidden>
            {SWATCHES[palette].map((color, i) => (
              <span
                key={color}
                className={`size-3.5 rounded-full ring-2 ring-card ${i > 0 ? "-ml-1" : ""}`}
                style={{ background: color }}
              />
            ))}
          </span>
          {labels[palette]}
        </button>
      ))}
    </div>
  );
}
