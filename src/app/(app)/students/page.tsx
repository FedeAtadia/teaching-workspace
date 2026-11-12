import { ChevronRight, Upload } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Initials } from "@/components/Initials";
import { PageHeader } from "@/components/PageHeader";
import { AddStudentDialog } from "@/components/students/AddStudentDialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db";
import { listCourses } from "@/db/queries/classes";
import { listStudents } from "@/db/queries/students";
import { listOwed } from "@/db/queries/yearEnd";
import { getFollowUp } from "@/db/queries/followUp";
import { todayInArgentina } from "@/lib/calendar";
import { listGraduateDeletions } from "@/db/queries/retention";
import { formatDate } from "@/lib/format";
import { StudentFilters } from "@/components/students/StudentFilters";
import { filterStudents, isGraduate, resolveView, STUDENT_VIEWS, type StudentView } from "@/lib/students";
import { requireTeacherId } from "@/lib/auth";
import { formatCourse, type Shift } from "@/lib/courses";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const t = await getTranslations("students");
  const tShift = await getTranslations("shifts");
  const tCommon = await getTranslations("common");
  const tFollow = await getTranslations("followUp");

  if (!isSupabaseConfigured()) {
    return (
      <PageHeader title={t("title")}>
        <p className="text-sm text-muted-foreground">{tCommon("notConfigured")}</p>
      </PageHeader>
    );
  }

  const db = getDb();
  const teacherId = await requireTeacherId();
  const [courses, everyone, owed, followUp, params] = await Promise.all([
    listCourses(db, teacherId),
    listStudents(db, teacherId),
    listOwed(db, teacherId),
    getFollowUp(db, teacherId, todayInArgentina()),
    searchParams,
  ]);

  // STUDENT-5, STUDENT-6: the view and the course come from the address.
  // FOLLOW-3, FOLLOW-4: with follow-up off, its view isn't on offer.
  const views = STUDENT_VIEWS.filter((v) => v !== "followUp" || followUp.enabled);
  const asked = resolveView(typeof params.view === "string" ? params.view : undefined);
  const view = views.includes(asked) ? asked : "current";
  const following = new Set(followUp.students.map((s) => s.studentId));
  const courseId = courses.find((c) => c.id === params.course)?.id;
  const owing = new Set(owed.flatMap((c) => c.students.map((s) => s.student.id)));
  const students = filterStudents(everyone, { view, courseId }, owing, following);
  // KEEP-1: under "Egresados", the day each one will be deleted.
  const deleteOn = new Map(
    view === "graduates" ? (await listGraduateDeletions(db, teacherId)).map((g) => [g.studentId, g.deleteOn]) : [],
  );
  const counts = Object.fromEntries(
    STUDENT_VIEWS.map((v) => [v, filterStudents(everyone, { view: v, courseId }, owing, following).length]),
  ) as Record<StudentView, number>;

  // The school only adds noise for a teacher at one school; with two, it tells the courses apart.
  const severalSchools = new Set(courses.map((c) => c.school)).size > 1;
  const courseLabel = (c: { year: number; division: string; shift: Shift; schoolYear: string; school: string }) =>
    `${formatCourse(c.year, c.division)} · ${tShift(c.shift)} · ${c.schoolYear}` + (severalSchools ? ` · ${c.school}` : "");

  const action =
    courses.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        {/* IMPORT-1: a whole course at once; it opens on the course being looked at. */}
        <Link
          href={courseId ? `/students/import?course=${courseId}` : "/students/import"}
          className={buttonVariants({ variant: "outline" })}
        >
          <Upload aria-hidden />
          {t("import")}
        </Link>
        <AddStudentDialog courses={courses.map((c) => ({ id: c.id, label: courseLabel(c) }))} />
      </div>
    ) : (
      <Button disabled>{t("add")}</Button>
    );

  return (
    <PageHeader title={t("title")} action={action}>
      {courses.length === 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {t("noCourses")}{" "}
          <Link href="/classes" className="underline underline-offset-4">
            {t("goToClasses")}
          </Link>
        </p>
      )}
      {everyone.length > 0 && (
        <StudentFilters
          view={view}
          views={views}
          courseId={courseId}
          courses={courses.map((c) => ({ id: c.id, label: courseLabel(c) }))}
          counts={counts}
          labels={{
            label: t("filters.label"),
            current: t("filters.current"),
            followUp: t("filters.followUp"),
            graduates: t("filters.graduates"),
            all: t("filters.all"),
            course: t("filters.course"),
            allCourses: t("filters.allCourses"),
          }}
        />
      )}
      {view === "graduates" && <p className="mb-4 text-sm text-muted-foreground">{t("graduatesHint")}</p>}
      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">{everyone.length === 0 ? t("empty") : t("emptyFilter")}</p>
      ) : (
        <>
          {/* Phone: one compact card per student; the whole card is the link (NAV-2). */}
          <ul className="grid gap-2 sm:hidden">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/students/${s.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border transition hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Initials firstName={s.firstName} lastName={s.lastName} className="size-10 text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {s.lastName}, <span className="font-normal">{s.firstName}</span>
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {s.courses.map(courseLabel).join(", ")}
                    </span>
                    {deleteOn.has(s.id) && (
                      <span className="block text-sm text-muted-foreground">
                        {t("deleteOn", { date: formatDate(deleteOn.get(s.id)!) })}
                      </span>
                    )}
                    {following.has(s.id) && (
                      <span className="mt-1 block">
                        <Badge tone="alert" dot>
                          {tFollow("badge")}
                        </Badge>
                      </span>
                    )}
                    {isGraduate(s) && (
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <Badge tone="accent">{t("graduated")}</Badge>
                        {owing.has(s.id) && (
                          <Badge tone="alert" dot>
                            {t("owes")}
                          </Badge>
                        )}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-2xl bg-card ring-1 ring-border sm:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  {(["lastName", "firstName", "course"] as const).map((col, i) => (
                    <TableHead
                      key={col}
                      className={`px-4 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase ${i === 0 ? "pl-5" : ""}`}
                    >
                      {t(`columns.${col}`)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  // NAV-2: the first cell's link stretches over the whole row.
                  <TableRow key={s.id} className="group relative cursor-pointer has-[a:focus-visible]:bg-muted">
                    <TableCell className="py-3 pr-4 pl-5">
                      <span className="flex items-center gap-3">
                        <Initials firstName={s.firstName} lastName={s.lastName} className="size-9" />
                        <Link
                          href={`/students/${s.id}`}
                          className="text-base font-bold outline-none after:absolute after:inset-0 after:content-['']"
                        >
                          {s.lastName}
                        </Link>
                      </span>
                    </TableCell>
                    <TableCell className="px-4 text-base">{s.firstName}</TableCell>
                    <TableCell className="px-4 whitespace-normal">
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex flex-wrap gap-1.5">
                          {s.courses.map(courseLabel).map((label) => (
                            <Badge key={label}>{label}</Badge>
                          ))}
                          {following.has(s.id) && (
                            <Badge tone="alert" dot>
                              {tFollow("badge")}
                            </Badge>
                          )}
                          {isGraduate(s) && <Badge tone="accent">{t("graduated")}</Badge>}
                          {deleteOn.has(s.id) && (
                            <span className="self-center text-sm text-muted-foreground">
                              {t("deleteOn", { date: formatDate(deleteOn.get(s.id)!) })}
                            </span>
                          )}
                          {isGraduate(s) && owing.has(s.id) && (
                            <Badge tone="alert" dot>
                              {t("owes")}
                            </Badge>
                          )}
                        </span>
                        <ChevronRight
                          className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-highlight"
                          aria-hidden
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </PageHeader>
  );
}
