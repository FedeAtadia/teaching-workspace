import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BringStudentsDialog } from "@/components/classes/BringStudentsDialog";
import { listClassStudents } from "@/db/queries/classDetail";
import { listNextYearCandidates } from "@/db/queries/nextYear";
import { formatCourse } from "@/lib/courses";
import { loadClass } from "./data";

export default async function ClassStudentsPage({ params }: PageProps<"/classes/[id]">) {
  const { id } = await params;
  const { db, teacherId, cls } = await loadClass(id);
  const t = await getTranslations("classPage.students");
  const tNext = await getTranslations("nextYear");
  const tShift = await getTranslations("shifts");
  const [roster, candidates] = await Promise.all([
    listClassStudents(db, teacherId, cls),
    listNextYearCandidates(db, teacherId, cls),
  ]);

  // NEXT-1: only when someone from last year can come into this course.
  const bring =
    candidates.length > 0 ? (
      <BringStudentsDialog
        classId={id}
        previousYear={String(Number(cls.schoolYear) - 1)}
        groups={candidates.map((g) => ({
          courseId: g.courseId,
          label: `${formatCourse(g.year, g.division)} · ${tShift(g.shift)} · ${g.schoolYear}`,
          reason: tNext(`reasons.${g.outcome}`),
          students: g.students.map((s) => ({ id: s.id, name: `${s.lastName}, ${s.firstName}` })),
        }))}
      />
    ) : null;

  if (roster.length === 0) {
    return (
      <div className="grid justify-items-start gap-4">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
        {bring}
      </div>
    );
  }
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("count", { count: roster.length })}</p>
        {bring}
      </div>
      {/* NAV-2: each whole card opens the student's history. */}
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((s, i) => (
          <li key={s.id}>
            <Link
              href={`/students/${s.id}`}
              className="group flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border transition hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-extrabold text-chalk tabular-nums">
                {i + 1}
              </span>
              <span className="flex-1 font-bold">
                {s.lastName}, <span className="font-normal">{s.firstName}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
