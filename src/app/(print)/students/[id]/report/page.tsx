import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { BackLink } from "@/components/BackLink";
import { ReportControls } from "@/components/students/ReportControls";
import { getDb } from "@/db";
import { getStudentHistory, type HistoryTask } from "@/db/queries/history";
import { requireTeacherId } from "@/lib/auth";
import { todayInArgentina } from "@/lib/calendar";
import { formatCourse } from "@/lib/courses";
import { formatDate, formatGrade } from "@/lib/format";
import { buildReport, reportOptions } from "@/lib/report";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/students/[id]/report">): Promise<Metadata> {
  const { id } = await params;
  if (!isSupabaseConfigured()) return {};
  const history = await getStudentHistory(getDb(), await requireTeacherId(), id);
  if (!history) return {};
  const t = await getTranslations("report");
  // The browser offers this as the PDF's file name.
  return { title: t("metaTitle", { name: `${history.student.lastName}, ${history.student.firstName}` }) };
}

/** The teacher's name as their Google account gives it, for the report's header. */
async function teacherName(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const meta = data?.claims.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
  const name = meta?.full_name ?? meta?.name;
  return typeof name === "string" && name.trim() !== "" ? name.trim() : null;
}

/**
 * REPORT-1..4: a student's report on one course, laid out for paper. Always
 * black on white, whatever the theme: it is a document, not a screen.
 */
export default async function StudentReportPage({ params, searchParams }: PageProps<"/students/[id]/report">) {
  const { id } = await params;
  if (!isSupabaseConfigured()) notFound();
  const [history, query, teacher] = await Promise.all([
    getStudentHistory(getDb(), await requireTeacherId(), id),
    searchParams,
    teacherName(),
  ]);
  if (!history) notFound();

  const t = await getTranslations("report");
  const tApp = await getTranslations("app");
  const tShift = await getTranslations("shifts");
  const tTerm = await getTranslations("terms");
  const tResult = await getTranslations("closing.results");
  const tOutcome = await getTranslations("studentPage.outcomes");
  const locale = await getLocale();
  const options = reportOptions(query);
  const report = buildReport(history, options);
  const today = todayInArgentina();
  const grade = (value: number | null) => (value === null ? "—" : formatGrade(value, locale));

  if (!report) {
    return (
      <>
        <BackLink href={`/students/${id}`} label={t("back")} />
        <p className="mt-6 text-muted-foreground">{t("noCourse")}</p>
      </>
    );
  }
  const { student, course } = report;
  const courseName = (c: { year: number; division: string; shift: typeof course.shift; schoolYear: string }) =>
    `${formatCourse(c.year, c.division)} · ${tShift(c.shift)} · ${c.schoolYear}`;

  const result = (r: (typeof report.classes)[number]["result"]) =>
    r.kind === "passedByExam"
      ? tResult("passedByExam", { date: formatDate(r.exam.takenOn), grade: formatGrade(r.exam.value, locale) })
      : tResult(r.kind);
  const score = (s: HistoryTask["score"]) => {
    if (!s) return t("scores.none");
    const text = s.status === "missing" ? t("scores.missing") : s.status === "excused" ? t("scores.excused") : grade(s.value);
    return s.adapted ? `${text} (${t("scores.adapted")})` : text;
  };

  return (
    <>
      {/*
        REPORT-4: with no page margin the browser has nowhere to print its own
        header and footer (the date, the title, the address). The margins are
        drawn by the report instead: see the spacer rows below.
      */}
      <style>{"@page { size: A4; margin: 0; } @media print { html, body { background: #fff !important; } }"}</style>
      <div className="grid gap-4 print:hidden">
        <BackLink href={`/students/${id}`} label={t("back")} />
        <ReportControls
          studentId={id}
          courseId={course.courseId}
          courses={report.courses.map((c) => ({ id: c.courseId, label: courseName(c) }))}
          tasks={options.tasks}
          adaptations={options.adaptations}
          labels={{
            course: t("options.course"),
            tasks: t("options.tasks"),
            adaptations: t("options.adaptations"),
            print: t("print"),
            printHint: t("printHint"),
          }}
        />
      </div>

      <article className="mt-6 bg-white p-6 text-[13px] leading-snug text-neutral-900 shadow-sm ring-1 ring-neutral-200 sm:p-10 print:mt-0 print:px-[14mm] print:py-0 print:shadow-none print:ring-0">
        {/*
          A table only for its header and footer rows: a browser repeats them
          on every printed page, which gives each page its top and bottom
          margin. On screen they don't show.
        */}
        <table className="w-full border-collapse">
          <thead className="hidden print:table-header-group">
            <tr>
              <td className="h-[14mm] p-0" />
            </tr>
          </thead>
          <tfoot className="hidden print:table-footer-group">
            <tr>
              <td className="h-[14mm] p-0" />
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td className="p-0">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-neutral-900 pb-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">{t("title")}</p>
            <h1 className="mt-1 font-heading text-3xl leading-none font-bold">
              {student.lastName}, {student.firstName}
            </h1>
          </div>
          {/* The name in plain black: the themed logo would take the screen's colours onto the paper. */}
          <p className="font-heading text-xl leading-none font-bold lowercase">{tApp("name")}</p>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
          <Fact label={t("fields.course")}>
            {formatCourse(course.year, course.division)} · {tShift(course.shift)}
            {course.status === "withdrawn" && ` (${t("left")})`}
          </Fact>
          <Fact label={t("fields.school")}>{course.school}</Fact>
          <Fact label={t("fields.schoolYear")}>{course.schoolYear}</Fact>
          {teacher && <Fact label={t("fields.teacher")}>{teacher}</Fact>}
          <Fact label={t("fields.date")}>{formatDate(today)}</Fact>
          {course.outcome && <Fact label={t("fields.outcome")}>{tOutcome(course.outcome)}</Fact>}
        </dl>

        {report.classes.length === 0 && <p className="mt-6 text-neutral-600">{t("noClasses")}</p>}

        {report.classes.map((cls) => (
          <section key={cls.id} className="mt-7 break-inside-avoid">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-neutral-400 pb-1.5">
              <h2 className="font-heading text-xl leading-tight font-bold">{cls.name}</h2>
              <p className="text-[11px] text-neutral-600">{t("passMark", { grade: grade(cls.passMark) })}</p>
            </div>

            {cls.terms.length === 0 ? (
              <p className="mt-2 text-neutral-600">{t("noTerms")}</p>
            ) : (
              <table className="mt-2 w-full border-collapse text-left tabular-nums">
                <thead>
                  <tr className="text-[11px] text-neutral-600">
                    <Th>{t("columns.term")}</Th>
                    <Th right>{t("columns.average")}</Th>
                    <Th right>{t("columns.missing")}</Th>
                    <Th right>{t("columns.attendance")}</Th>
                    <Th right>{t("columns.grade")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {cls.terms.map((term) => (
                    <tr key={term.position} className="border-t border-neutral-200">
                      <Td>{tTerm(String(term.position))}</Td>
                      <Td right>{grade(term.average)}</Td>
                      <Td right>{term.missing}</Td>
                      <Td right>{term.attendance === null ? "—" : `${term.attendance} %`}</Td>
                      <Td right bold>
                        {grade(term.grade)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="mt-2 flex flex-wrap gap-x-8 gap-y-1 border-t border-neutral-400 pt-2">
              <span>
                <span className="text-neutral-600">{t("finalGrade")}:</span>{" "}
                <span className="font-bold tabular-nums">{grade(cls.finalGrade)}</span>
              </span>
              <span>
                <span className="text-neutral-600">{t("result")}:</span>{" "}
                <span className="font-bold">{result(cls.result)}</span>
              </span>
            </p>
            {cls.exams.length > 0 && (
              <p className="mt-1">
                <span className="text-neutral-600">{t("exams")}:</span>{" "}
                {cls.exams
                  .map(
                    (e) =>
                      `${formatDate(e.takenOn)} ${e.status === "absent" || e.value === null ? t("examAbsent") : grade(e.value)}`,
                  )
                  .join(", ")}
              </p>
            )}
            {cls.adaptation && (
              <p className="mt-1 whitespace-pre-line">
                <span className="text-neutral-600">{t("adaptation")}:</span> {cls.adaptation}
              </p>
            )}

            {/* REPORT-3 */}
            {cls.terms
              .filter((term) => term.tasks.length > 0)
              .map((term) => (
                <div key={term.position} className="mt-3">
                  <h3 className="text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                    {t("tasks", { term: tTerm(String(term.position)) })}
                  </h3>
                  <table className="mt-1 w-full border-collapse text-left">
                    <thead>
                      <tr className="text-[11px] text-neutral-600">
                        <Th>{t("taskColumns.task")}</Th>
                        <Th>{t("taskColumns.date")}</Th>
                        <Th>{t("taskColumns.score")}</Th>
                        <Th>{t("taskColumns.notes")}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {term.tasks.map((task) => (
                        <tr key={task.id} className="border-t border-neutral-200 align-top">
                          <Td>{task.title}</Td>
                          <Td>{task.dueOn ? formatDate(task.dueOn) : ""}</Td>
                          <Td bold>{score(task.score)}</Td>
                          <Td>{task.score?.notes ?? ""}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </section>
        ))}

        {/* REPORT-2 */}
        {report.owedElsewhere.length > 0 && (
          <section className="mt-7 break-inside-avoid">
            <h2 className="border-b border-neutral-400 pb-1.5 font-heading text-xl leading-tight font-bold">
              {t("owedElsewhere")}
            </h2>
            <ul className="mt-2 grid list-disc gap-0.5 pl-5">
              {report.owedElsewhere.map((o) => (
                <li key={`${o.schoolYear}-${o.name}`}>
                  {t("owedLine", { name: o.name, course: formatCourse(o.year, o.division), year: o.schoolYear })}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-8 border-t border-neutral-300 pt-2 text-[11px] text-neutral-500">
          {t("footer", { date: formatDate(today) })}
        </footer>
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-neutral-500">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th className={`py-1 pr-3 font-semibold last:pr-0 ${right ? "text-right" : ""}`}>{children}</th>;
}

function Td({ children, right, bold }: { children: ReactNode; right?: boolean; bold?: boolean }) {
  return (
    <td className={`py-1 pr-3 last:pr-0 ${right ? "text-right" : ""} ${bold ? "font-bold" : ""}`}>{children}</td>
  );
}
