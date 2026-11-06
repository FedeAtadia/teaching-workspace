import { CalendarDays, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

/**
 * HOME-1..3, NAV-2: one class as a card; the whole card is a single link.
 * Texts arrive already written in the teacher's language.
 */
export function ClassCard({
  href,
  name,
  course,
  courseLine,
  shift,
  studentsText,
  progress,
  progressText,
  nextText,
}: {
  href: string;
  name: string;
  /** "4° A" (COURSE-2). */
  course: string;
  /** The school year, and the school when the teacher has several. */
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
      className="group flex flex-col gap-4 rounded-2xl bg-card p-5 text-card-foreground ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="pt-0.5 text-[0.7rem] font-semibold tracking-[0.12em] text-highlight uppercase">{shift}</span>
        <Badge tone="accent" className="tabular-nums">
          {progress}%
        </Badge>
      </div>
      <div>
        <h3 className="text-xl leading-tight font-bold">
          {course} · {name}
        </h3>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden />
          {[studentsText, courseLine].filter(Boolean).join(" · ")}
        </p>
      </div>
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
      <div className="mt-auto flex items-center gap-2 border-t pt-3 text-sm">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1">{nextText}</span>
        <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}
