import { BookOpen, Puzzle } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { FormDialog } from "@/components/forms/FormDialog";
import { listCourses } from "@/db/queries/classes";
import { editStudentAction, moveStudentAction, removeStudent } from "../actions";
import { Initials } from "@/components/Initials";
import { Badge } from "@/components/ui/badge";
import { AdaptedBadge } from "@/components/classes/Adaptation";
import { ResultLabel } from "@/components/classes/StudentExams";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { getStudentHistory } from "@/db/queries/history";
import { requireTeacherId } from "@/lib/auth";
import { formatCourse } from "@/lib/courses";
import { formatDate, formatGrade } from "@/lib/format";
import { DEFAULT_RULES, isPassing } from "@/lib/grading";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** HISTORY-1..4 */
export default async function StudentPage({ params }: PageProps<"/students/[id]">) {
  const { id } = await params;
  if (!isSupabaseConfigured()) notFound();
  const teacherId = await requireTeacherId();
  const [history, allCourses] = await Promise.all([
    getStudentHistory(getDb(), teacherId, id),
    listCourses(getDb(), teacherId),
  ]);
  if (!history) notFound();

  const t = await getTranslations("studentPage");
  const tShift = await getTranslations("shifts");
  const tTerm = await getTranslations("terms");
  const tGrades = await getTranslations("classPage.grades");
  const tDash = await getTranslations("dashboard.stats");
  const tAdapt = await getTranslations("adaptations");
  const locale = await getLocale();
  const { student, courses } = history;
  // The header's badges: the newest course (HISTORY-1 lists it first), any adaptation in it, and what is owed.
  // A course they left (STUDENT-8) is not where they are now.
  const current = courses.find((c) => c.status === "active") ?? courses[0];
  const adapted = current?.classes.some((c) => c.adaptation) ?? false;
  const owed = courses.flatMap((c) => c.classes).filter((c) => c.result.kind === "owed").length;
  const tStudents = await getTranslations("students.fields");
  /** STUDENT-8: the other courses of that school year the student isn't already in. */
  const moveOptions = (from: { courseId: string; schoolYear: string }) =>
    allCourses
      .filter(
        (c) =>
          c.schoolYear === from.schoolYear &&
          !courses.some((mine) => mine.courseId === c.id && mine.status === "active"),
      )
      .map((c) => ({
        value: c.id,
        label: `${formatCourse(c.year, c.division)} · ${tShift(c.shift)} · ${c.school}`,
      }));

  return (
    <>
      <BackLink href="/students" label={t("back")} />
      <header className="mt-2 mb-8 flex flex-wrap items-center gap-5 rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
        <Initials firstName={student.firstName} lastName={student.lastName} shape="square" />
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {student.lastName}, {student.firstName}
          </h1>
          {(current || owed > 0) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {current && (
                <Badge tone="neutral">
                  {formatCourse(current.year, current.division)} · {current.schoolYear}
                </Badge>
              )}
              {adapted && <Badge tone="accent">{tAdapt("badge")}</Badge>}
              {owed > 0 && (
                <Badge tone="alert" dot>
                  {owed} {tDash("owed", { count: owed })}
                </Badge>
              )}
            </div>
          )}
        </div>
        {/* STUDENT-7, STUDENT-4 */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FormDialog
            trigger="edit"
            triggerLabel={t("edit.button")}
            title={t("edit.title")}
            action={editStudentAction}
            hidden={{ studentId: student.id }}
            formErrors={{ notFound: t("edit.notFound") }}
            fields={[
              { kind: "text", name: "lastName", label: tStudents("lastName"), maxLength: 80, defaultValue: student.lastName },
              { kind: "text", name: "firstName", label: tStudents("firstName"), maxLength: 80, defaultValue: student.firstName },
            ]}
          />
          <ConfirmDeleteButton
            label={t("delete.button")}
            title={t("delete.title", { name: `${student.firstName} ${student.lastName}` })}
            body={t("delete.body")}
            action={removeStudent.bind(null, { studentId: student.id })}
          />
        </div>
      </header>

      {courses.length === 0 && <p className="text-sm text-muted-foreground">{t("noCourses")}</p>}

      <div className="grid gap-10">
        {courses.map((course) => (
          <section key={course.courseId}>
            <h2 className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xl font-bold">
              {course.schoolYear} · {formatCourse(course.year, course.division)}
              <span className="text-base font-normal text-muted-foreground">
                {tShift(course.shift)} · {course.school}
              </span>
              {course.status === "withdrawn" && <Badge tone="outline">{t("left")}</Badge>}
              {course.outcome && <Badge tone="accent">{t(`outcomes.${course.outcome}`)}</Badge>}
              {/* STUDENT-8: only between courses of the same school year. */}
              {course.status === "active" && moveOptions(course).length > 0 && (
                <FormDialog
                  trigger="text"
                  triggerLabel={t("move.button")}
                  title={t("move.title", { name: `${student.firstName} ${student.lastName}` })}
                  description={t("move.description", {
                    course: formatCourse(course.year, course.division),
                    year: course.schoolYear,
                  })}
                  action={moveStudentAction}
                  hidden={{ studentId: student.id, fromCourseId: course.courseId }}
                  formErrors={{ notFound: t("move.notFound"), otherYear: t("move.otherYear") }}
                  fields={[{ kind: "select", name: "toCourseId", label: t("move.to"), options: moveOptions(course) }]}
                />
              )}
            </h2>

            {course.classes.length === 0 && <p className="text-sm text-muted-foreground">{t("noClasses")}</p>}

            <div className="grid gap-4">
              {course.classes.map((cls) => {
                const rules = { ...DEFAULT_RULES, passMark: cls.passMark };
                const isOwed = cls.result.kind === "owed";
                return (
                  <article
                    key={cls.id}
                    className={`relative grid gap-4 overflow-hidden rounded-2xl bg-card p-5 ring-1 ${isOwed ? "pl-6 ring-destructive/40" : "ring-border"}`}
                  >
                    {/* An owed class (previa) gets a red edge. */}
                    {isOwed && <span className="absolute inset-y-0 left-0 w-1.5 bg-alert" aria-hidden />}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="flex items-center gap-3 text-lg font-bold">
                        <span
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-highlight-soft text-highlight"
                          aria-hidden
                        >
                          <BookOpen className="size-5" />
                        </span>
                        <span>
                          <Link href={`/classes/${cls.id}`} className="underline-offset-4 hover:underline">
                            {cls.name}
                          </Link>
                          {/* ADAPT-1 */}
                          {cls.adaptation && <AdaptedBadge notes={cls.adaptation} />}
                        </span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-3">
                        {/* HISTORY-4: the result once there is a final grade. */}
                        {cls.result.kind !== "pending" && (
                          <Badge tone={isOwed ? "alert" : "accent"}>
                            <ResultLabel result={cls.result} />
                          </Badge>
                        )}
                        {/* TERM-1, TERM-7: the 2° cuatrimestre grade. */}
                        {cls.finalGrade !== null && (
                          <p className="flex items-baseline gap-2 rounded-xl bg-muted px-3 py-1.5 text-sm">
                            <span className="text-muted-foreground">{t("finalGrade")}</span>
                            <Grade value={cls.finalGrade} passing={isPassing(cls.finalGrade, rules)} locale={locale} big />
                          </p>
                        )}
                      </div>
                    </div>
                    {cls.adaptation && (
                      <p className="flex gap-3 rounded-xl bg-highlight-soft px-4 py-3 text-sm text-accent-foreground">
                        <Puzzle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="whitespace-pre-line">
                          <span className="font-bold">{tAdapt("badge")}:</span> {cls.adaptation}
                        </span>
                      </p>
                    )}
                    {/* HISTORY-4: the exams, in a strip (red while still owed). */}
                    {cls.exams.length > 0 && (
                      <p className={`rounded-xl px-4 py-2.5 text-sm ${isOwed ? "bg-alert-soft" : "bg-muted"}`}>
                        <span className="font-bold">{t("exams")}:</span>{" "}
                        {cls.exams
                          .map(
                            (e) =>
                              `${formatDate(e.takenOn)} ${
                                e.status === "absent" || e.value === null ? t("absent") : formatGrade(e.value, locale)
                              }`,
                          )
                          .join(", ")}
                      </p>
                    )}
                    {cls.terms.length === 0 && <p className="text-sm text-muted-foreground">{t("noTasks")}</p>}
                    {/* One box per cuatrimestre: its grade (or the average so far), then the details. */}
                    {cls.terms.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {cls.terms.map((term) => {
                          const shown = term.grade ?? term.suggestion.average;
                          return (
                            <div key={term.position} className="rounded-xl bg-muted/60 px-4 py-3">
                              <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                                {tTerm(String(term.position))}
                              </p>
                              <p className="mt-1 font-heading text-3xl font-bold tabular-nums">
                                {shown === null ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <Grade value={shown} passing={isPassing(shown, rules)} locale={locale} />
                                )}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                                {[
                                  term.grade !== null ? t("grade") : null,
                                  `${t("average")} ${term.suggestion.average === null ? "—" : formatGrade(term.suggestion.average, locale)}${
                                    term.suggestion.missing > 0
                                      ? ` (${term.suggestion.missing} ${tGrades("missingShort")})`
                                      : ""
                                  }`,
                                  // HISTORY-5
                                  term.attendance !== null ? t("attendance", { rate: term.attendance }) : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {cls.terms
                      .filter((term) => term.tasks.length > 0)
                      .map((term) => (
                      <div key={term.position}>
                        <h4 className="mb-1 text-sm font-semibold text-muted-foreground">
                          {tTerm(String(term.position))}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <tbody>
                              {term.tasks.map((task) => (
                                // NAV-2: the task's link stretches over its row.
                                <tr
                                  key={task.id}
                                  className="relative border-t align-top hover:bg-muted/60 has-[a:focus-visible]:bg-muted"
                                >
                                  <td className="py-2 pr-3 pl-1 font-bold">
                                    <Link
                                      href={`/classes/${cls.id}/tasks/${task.id}`}
                                      className="outline-none after:absolute after:inset-0 after:content-['']"
                                    >
                                      {task.title}
                                    </Link>
                                  </td>
                                  <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">
                                    {task.dueOn ? formatDate(task.dueOn) : ""}
                                  </td>
                                  <td className="py-1.5 pr-3 text-center tabular-nums">
                                    <ScoreCell
                                      score={task.score}
                                      rules={rules}
                                      locale={locale}
                                      labels={{
                                        missing: tGrades("missing"),
                                        excused: tGrades("excused"),
                                        adapted: tGrades("adapted"),
                                        adaptedShort: tGrades("adaptedShort"),
                                      }}
                                    />
                                  </td>
                                  <td className="py-1.5 text-muted-foreground">{task.score?.notes ?? ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function Grade({
  value,
  passing,
  locale,
  big = false,
}: {
  value: number;
  passing: boolean;
  locale: string;
  big?: boolean;
}) {
  return (
    <span className={[big ? "text-lg font-extrabold" : "font-bold", passing ? "" : "text-destructive"].join(" ")}>
      {formatGrade(value, locale)}
    </span>
  );
}

function ScoreCell({
  score,
  rules,
  locale,
  labels,
}: {
  score: { status: string; value: number | null; adapted: boolean } | null;
  rules: typeof DEFAULT_RULES;
  locale: string;
  labels: { missing: string; excused: string; adapted: string; adaptedShort: string };
}) {
  if (!score) return <span className="text-muted-foreground">—</span>;
  if (score.status === "missing") return <span className="text-destructive">{labels.missing}</span>;
  if (score.status === "excused") return <span className="text-muted-foreground">{labels.excused}</span>;
  if (score.value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={isPassing(score.value, rules) ? "" : "font-medium text-destructive"}>
      {formatGrade(score.value, locale)}
      {/* ADAPT-4 */}
      {score.adapted && (
        <abbr title={labels.adapted} className="ml-0.5 align-super text-[0.65rem] text-highlight no-underline">
          {labels.adaptedShort}
        </abbr>
      )}
    </span>
  );
}
