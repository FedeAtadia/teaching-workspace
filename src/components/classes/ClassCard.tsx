import { BookOpen, CalendarDays, ChevronRight, Users } from "lucide-react";
import Link from "next/link";

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
      className="group flex flex-col gap-4 rounded-2xl bg-card p-5 text-card-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_8px_24px_rgb(0_0_0/0.12)] ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-chalk">
          <BookOpen className="size-5" aria-hidden />
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">{shift}</span>
      </div>
      <div>
        <h3 className="text-xl leading-tight font-extrabold">{name}</h3>
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
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
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
