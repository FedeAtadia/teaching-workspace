import { BookOpen, CalendarDays, ChevronRight, Users } from "lucide-react";
import Link from "next/link";

/** The strip on top of a card. Picked from the class's address, so a class keeps its colour on every page. */
const STRIPES = ["bg-primary", "bg-accent-deep", "bg-chart-4"];
const stripeOf = (href: string) => STRIPES[[...href].reduce((n, ch) => n + ch.charCodeAt(0), 0) % STRIPES.length];

/**
 * HOME-1..3, NAV-2: one class as a card; the whole card is a single link.
 * Texts arrive already written in the teacher's language.
 */
export function ClassCard({
  href,
  name,
  courseLine,
  shift,
  studentsText,
  progress,
  progressText,
  nextText,
}: {
  href: string;
  name: string;
  courseLine: string;
  shift: string;
  studentsText: string;
  progress: number;
  progressText: string;
  nextText: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-card p-5 pt-7 text-card-foreground ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className={`absolute inset-x-0 top-0 h-2 ${stripeOf(href)}`} aria-hidden />
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-highlight-soft text-highlight">
          <BookOpen className="size-5" aria-hidden />
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">{shift}</span>
      </div>
      <div>
        <h3 className="text-xl leading-tight font-bold">{name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{courseLine}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden />
          {studentsText}
        </p>
      </div>
      <div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={progressText}
        >
          <div className="h-full rounded-full bg-accent-deep" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{progressText}</p>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-dashed pt-3 text-sm">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1">{nextText}</span>
        <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}
