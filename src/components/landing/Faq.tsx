import { Plus } from "lucide-react";

/**
 * Questions that open in place. Native <details>, so it needs no JavaScript
 * and works the same with a keyboard or a screen reader.
 */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <details key={item.q} open={i === 0} className="group rounded-2xl border border-border bg-card">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-3 text-[17px] font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <Plus aria-hidden className="size-5 shrink-0 text-highlight transition-transform group-open:rotate-45" />
          </summary>
          <p className="px-5 pb-[18px] text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
