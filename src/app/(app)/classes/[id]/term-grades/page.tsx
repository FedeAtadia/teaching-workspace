import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { TermGradesForm } from "@/components/classes/TermGradesForm";
import { getAdaptations } from "@/db/queries/adaptations";
import { getAttendanceRates } from "@/db/queries/attendance";
import { listTerms } from "@/db/queries/classDetail";
import { getMinAttendance } from "@/db/queries/settings";
import { listTasks } from "@/db/queries/tasks";
import { getTermGradeSheet } from "@/db/queries/termGrades";
import { belowMinimum } from "@/lib/attendance";
import { formatGrade } from "@/lib/format";
import { loadClass } from "../data";

/** TERM-5..7: one cuatrimestre at a time, chosen with ?term=1 or ?term=2. */
export default async function TermGradesPage({ params, searchParams }: PageProps<"/classes/[id]/term-grades">) {
  const { id } = await params;
  const { term: termParam } = await searchParams;
  const { db, teacherId, cls, rules } = await loadClass(id);
  const [terms, tasks] = await Promise.all([listTerms(db, teacherId, cls), listTasks(db, teacherId, cls)]);

  // As in the gradebook: the latest cuatrimestre that has tasks, the one being taught.
  const latestWithTasks = Math.max(1, ...tasks.map((t) => t.termPosition));
  const position = termParam === "1" || termParam === "2" ? Number(termParam) : latestWithTasks;
  const term = terms.find((t) => t.position === position) ?? terms[0];
  const [sheet, rates, minimum, adaptations] = await Promise.all([
    term ? getTermGradeSheet(db, teacherId, cls, term.id) : null,
    term ? getAttendanceRates(db, teacherId, cls, term.position) : new Map(),
    getMinAttendance(db, teacherId),
    getAdaptations(db, teacherId, id),
  ]);
  if (!term || !sheet) notFound();

  const t = await getTranslations("classPage.termGrades");
  const tTerm = await getTranslations("terms");
  const locale = await getLocale();

  return (
    <>
      <nav className="mb-4 inline-flex gap-1 rounded-xl bg-muted p-1 ring-1 ring-border">
        {terms.map((tm) => (
          <Link
            key={tm.id}
            href={`/classes/${id}/term-grades?term=${tm.position}`}
            aria-current={tm.id === term.id ? "page" : undefined}
            className="flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-muted-foreground hover:text-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
          >
            {tTerm(String(tm.position))}
          </Link>
        ))}
      </nav>
      <p className="mb-4 text-sm text-muted-foreground">
        {sheet.position === 2 ? t("introSecond") : t("introFirst")}
      </p>

      {sheet.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
      ) : (
        <TermGradesForm
          // A new form for each cuatrimestre, so switching never keeps the other's typing.
          key={term.id}
          classId={id}
          termId={term.id}
          second={sheet.position === 2}
          rules={rules}
          rows={sheet.rows.map(({ student, suggestion, saved, firstTerm }) => ({
            studentId: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            adaptation: adaptations.get(student.id) ?? null,
            suggestion,
            lowAttendance: belowMinimum(rates.get(student.id)?.rate ?? null, minimum)
              ? rates.get(student.id)!.rate
              : null,
            grade: saved ? formatGrade(saved.value, locale) : "",
            notes: saved?.notes ?? "",
            reason: saved?.outsideRangeReason ?? "",
            firstTerm,
          }))}
        />
      )}
    </>
  );
}
