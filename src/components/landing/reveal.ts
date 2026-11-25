import type { CSSProperties } from "react";

/**
 * Props for an element that rises in as it scrolls into view (LAND-7),
 * `delay` steps of 100 ms after its neighbours. RevealOnScroll does the
 * watching; a plain module so server components can call it.
 */
export function reveal(delay = 0) {
  return { "data-reveal": "", style: { "--reveal-delay": delay } as CSSProperties };
}
