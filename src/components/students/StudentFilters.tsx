"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { STUDENT_VIEWS, type StudentView } from "@/lib/students";

/** The Students page's address for a view and a course. The defaults leave the address clean. */
export function studentsHref(view: StudentView, courseId: string | undefined): string {
  const params = new URLSearchParams();
  if (view !== "current") params.set("view", view);
  if (courseId) params.set("course", courseId);
  const query = params.toString();
  return query ? `/students?${query}` : "/students";
}

/**
 * STUDENT-5, STUDENT-6: which students show — a segmented control for the
 * view, a dropdown for the course. Both live in the address, so a reload or
 * coming back from a student keeps them.
 */
export function StudentFilters({
  view,
  courseId,
  courses,
  counts,
  labels,
}: {
  view: StudentView;
  courseId: string | undefined;
  courses: { id: string; label: string }[];
  /** How many students each view has, for the chosen course. */
  counts: Record<StudentView, number>;
  labels: Record<StudentView, string> & { label: string; course: string; allCourses: string };
}) {
  const router = useRouter();
  const chip =
    "flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <nav aria-label={labels.label} className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1 ring-1 ring-border">
        {STUDENT_VIEWS.map((v) => (
          <Link key={v} href={studentsHref(v, courseId)} aria-current={view === v ? "page" : undefined} className={chip}>
            {labels[v]}
            <span className="text-xs font-normal tabular-nums opacity-70">{counts[v]}</span>
          </Link>
        ))}
      </nav>
      <NativeSelect
        aria-label={labels.course}
        value={courseId ?? ""}
        onChange={(e) => router.push(studentsHref(view, e.target.value || undefined))}
        className="w-full sm:w-auto sm:min-w-56"
      >
        <NativeSelectOption value="">{labels.allCourses}</NativeSelectOption>
        {courses.map((c) => (
          <NativeSelectOption key={c.id} value={c.id}>
            {c.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
