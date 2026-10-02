import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { TermGradesForm } from "@/components/classes/TermGradesForm";
import { listTerms } from "@/db/queries/classDetail";
import { listTasks } from "@/db/queries/tasks";
import { getTermGradeSheet } from "@/db/queries/termGrades";
import { formatGrade } from "@/lib/format";
import { DEFAULT_RULES } from "@/lib/grading";
import { loadClass } from "../data";

/** TERM-5..7: one cuatrimestre at a time, chosen with ?term=1 or ?term=2. */
export default async function TermGradesPage({ params, searchParams }: PageProps<"/classes/[id]/term-grades">) {
  const { id } = await params;
  const { term: termParam } = await searchParams;
  const { db, teacherId, cls } = await loadClass(id);
  const [terms, tasks] = await Promise.all([listTerms(db, teacherId, cls), listTasks(db, teacherId, cls)]);

  // As in the gradebook: the latest cuatrimestre that has tasks, the one being taught.
  const latestWithTasks = Math.max(1, ...tasks.map((t) => t.termPosition));
  const position = termParam === "1" || termParam === "2" ? Number(termParam) : latestWithTasks;
  const term = terms.find((t) => t.position === position) ?? terms[0];
  const sheet = term ? await getTermGradeSheet(db, teacherId, cls, term.id) : null;
  if (!term || !sheet) notFound();

  const t = await getTranslations("classPage.termGrades");
  const tTerm = await getTranslations("terms");
  const locale = await getLocale();
  const rules = { ...DEFAULT_RULES, passMark: cls.passMark ?? DEFAULT_RULES.passMark };

  return (
    <>
      <nav className="mb-4 flex gap-2">
        {terms.map((tm) => (
          <Link
            key={tm.id}
            href={`/classes/${id}/term-grades?term=${tm.position}`}
            aria-current={tm.id === term.id ? "page" : undefined}
            className="flex h-10 items-center rounded-full bg-muted px-4 text-sm font-bold text-muted-foreground hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
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
            name: `${student.lastName}, ${student.firstName}`,
            suggestion,
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
