"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "cn";

/**
 * Questions that open in place, one at a time (LAND-8): the first starts
 * open, opening another closes it, and tapping the open one closes it too.
 * Answers slide open; with reduced motion they simply appear. Closed answers
 * stay in the page for search engines but are hidden from screen readers.
 */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const isOpen = open === i;
        const panel = `${id}-${i}`;
        return (
          <div
            key={item.q}
            className={cn(
              "rounded-2xl border bg-card motion-safe:transition-[border-color,box-shadow,transform] motion-safe:duration-300",
              isOpen
                ? "border-primary/60 shadow-[0_18px_40px_-28px_rgb(0_0_0/0.45)]"
                : "border-border hover:border-primary/40 motion-safe:hover:-translate-y-0.5",
            )}
          >
            <h3>
              <button
                type="button"
                id={`${panel}-q`}
                aria-expanded={isOpen}
                aria-controls={panel}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-5 py-3 text-left font-sans text-[17px] font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span>{item.q}</span>
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full motion-safe:transition-[transform,background-color,color] motion-safe:duration-300",
                    isOpen ? "rotate-45 bg-primary text-primary-foreground" : "bg-accent text-highlight",
                  )}
                >
                  <Plus className="size-[18px]" />
                </span>
              </button>
            </h3>
            {/* 0fr → 1fr rows: the answer's own height, animated without measuring it. */}
            <div
              id={panel}
              role="region"
              aria-labelledby={`${panel}-q`}
              aria-hidden={!isOpen}
              inert={!isOpen}
              className={cn(
                "grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-300 motion-safe:ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-[18px] text-muted-foreground">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
