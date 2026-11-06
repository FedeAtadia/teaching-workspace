import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

/**
 * One figure as a tile: a small label with an icon, then the number with its
 * unit. `accent` marks the tile to look at; `alert` fills it in red for
 * something owed. With `href` the whole tile opens that page (NAV-2).
 */
export function StatTile({
  label,
  value,
  unit,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: number;
  unit: string;
  icon: LucideIcon;
  tone?: "default" | "accent" | "alert";
  href?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-2xl p-4 ring-1 transition sm:p-5",
        "has-[a:hover]:-translate-y-0.5 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring",
        tone === "alert"
          ? "bg-alert-deep text-white ring-alert-deep"
          : tone === "accent"
            ? "bg-highlight-soft text-accent-foreground ring-primary"
            : "bg-card text-card-foreground ring-border has-[a:hover]:ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <dt
          className={cn(
            "pt-1 text-[0.7rem] font-semibold tracking-[0.12em] uppercase sm:text-xs",
            tone === "default" && "text-muted-foreground",
          )}
        >
          {href ? (
            <Link href={href} className="outline-none after:absolute after:inset-0 after:content-['']">
              {label}
            </Link>
          ) : (
            label
          )}
        </dt>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10",
            tone === "alert" ? "bg-black/20" : tone === "accent" ? "bg-card text-highlight" : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          <Icon className="size-[18px]" />
        </span>
      </div>
      <dd className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-heading text-4xl leading-none font-bold tabular-nums sm:text-5xl">{value}</span>
        <span className={cn("text-sm", tone === "default" && "text-muted-foreground")}>{unit}</span>
      </dd>
    </div>
  );
}
