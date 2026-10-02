import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { getStudentHistory } from "@/db/queries/history";
import { requireTeacherId } from "@/lib/auth";
import { formatCourse } from "@/lib/courses";
import { formatDate, formatGrade } from "@/lib/format";
import { DEFAULT_RULES, isPassing } from "@/lib/grading";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** HISTORY-1..3 */
export default async function StudentPage({ params }: PageProps<"/students/[id]">) {
  const { id } = await params;
  if (!isSupabaseConfigured()) notFound();
  const history = await getStudentHistory(getDb(), await requireTeacherId(), id);
  if (!history) notFound();

  const t = await getTranslations("studentPage");
  const tShift = await getTranslations("shifts");
  const tTerm = await getTranslations("terms");
  const tGrades = await getTranslations("classPage.grades");
  const locale = await getLocale();
  const { student, courses } = history;

  return (
    <>
      <BackLink href="/students" label={t("back")} />
      <h1 className="mt-3 mb-6 text-3xl font-extrabold">
        {student.lastName}, {student.firstName}
      </h1>

      {courses.length === 0 && <p className="text-sm text-muted-foreground">{t("noCourses")}</p>}

      <div className="grid gap-8">
        {courses.map((course) => (
          <section key={course.courseId}>
            <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3 text-lg font-semibold">
              {course.schoolYear} · {formatCourse(course.year, course.division)} · {tShift(course.shift)} ·{" "}
              {course.school}
              {course.status === "withdrawn" && (
                <span className="text-sm font-normal text-muted-foreground">{t("left")}</span>
              )}
            </h2>

            {course.classes.length === 0 && <p className="text-sm text-muted-foreground">{t("noClasses")}</p>}

            <div className="grid gap-4">
              {course.classes.map((cls) => {
                const rules = { ...DEFAULT_RULES, passMark: cls.passMark };
                return (
                  <article key={cls.id} className="rounded-2xl bg-card p-5 ring-1 ring-border">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-lg font-extrabold">
                        <Link href={`/classes/${cls.id}`} className="underline-offset-4 hover:underline">
                          {cls.name}
                        </Link>
                      </h3>
                      {/* TERM-1, TERM-7: the 2° cuatrimestre grade. */}
                      {cls.finalGrade !== null && (
                        <p className="text-sm">
                          {t("finalGrade")}:{" "}
                          <Grade value={cls.finalGrade} passing={isPassing(cls.finalGrade, rules)} locale={locale} big />
                        </p>
                      )}
                    </div>
                    {cls.terms.length === 0 && (
                      <p className="mt-1 text-sm text-muted-foreground">{t("noTasks")}</p>
                    )}
                    {cls.terms.map((term) => (
                      <div key={term.position} className="mt-3">
                        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="text-sm font-semibold text-muted-foreground">
                            {tTerm(String(term.position))}
                          </h4>
                          <p className="text-sm tabular-nums">
                            {t("average")}:{" "}
                            {term.suggestion.average === null ? (
                              "—"
                            ) : (
                              <span
                                className={
                                  isPassing(term.suggestion.average, rules)
                                    ? "font-semibold"
                                    : "font-semibold text-destructive"
                                }
                              >
                                {formatGrade(term.suggestion.average, locale)}
                              </span>
                            )}
                            {term.suggestion.missing > 0 && (
                              <span className="ml-1 text-muted-foreground">
                                ({term.suggestion.missing} {tGrades("missingShort")})
                              </span>
                            )}
                            {term.grade !== null && (
                              <>
                                {" · "}
                                {t("grade")}:{" "}
                                <Grade value={term.grade} passing={isPassing(term.grade, rules)} locale={locale} />
                              </>
                            )}
                          </p>
                        </div>
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
                                    {task.dueOn ? formatDate(task.dueOn, locale) : ""}
                                  </td>
                                  <td className="py-1.5 pr-3 text-center tabular-nums">
                                    <ScoreCell
                                      score={task.score}
                                      rules={rules}
                                      locale={locale}
                                      labels={{ missing: tGrades("missing"), excused: tGrades("excused") }}
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
  score: { status: string; value: number | null } | null;
  rules: typeof DEFAULT_RULES;
  locale: string;
  labels: { missing: string; excused: string };
}) {
  if (!score) return <span className="text-muted-foreground">—</span>;
  if (score.status === "missing") return <span className="text-destructive">{labels.missing}</span>;
  if (score.status === "excused") return <span className="text-muted-foreground">{labels.excused}</span>;
  if (score.value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={isPassing(score.value, rules) ? "" : "font-medium text-destructive"}>
      {formatGrade(score.value, locale)}
    </span>
  );
}
