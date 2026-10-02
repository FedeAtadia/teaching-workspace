import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { OutcomeSelect } from "@/components/classes/OutcomeSelect";
import { ResultLabel, StudentExams } from "@/components/classes/StudentExams";
import { getClosingSheet } from "@/db/queries/yearEnd";
import { formatGrade } from "@/lib/format";
import { DEFAULT_RULES, isPassing } from "@/lib/grading";
import { allowedOutcomes } from "@/lib/yearEnd";
import { loadClass } from "../data";

/** YEAR-1..3, EXAM-1, EXAM-2 */
export default async function ClosingPage({ params }: PageProps<"/classes/[id]/closing">) {
  const { id } = await params;
  const { db, teacherId, cls } = await loadClass(id);
  const sheet = await getClosingSheet(db, teacherId, cls);
  const t = await getTranslations("closing");
  const locale = await getLocale();
  const passMark = cls.passMark ?? DEFAULT_RULES.passMark;
  const options = allowedOutcomes(cls.year);

  return (
    <>
      <p className="mb-4 max-w-prose text-sm text-muted-foreground">
        {t(cls.year >= 6 ? "introLast" : "intro")}{" "}
        <Link href={`/classes/${id}/term-grades?term=2`} className="font-bold text-foreground hover:underline">
          {t("toFinalGrades")}
        </Link>
      </p>

      {sheet.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
      ) : (
        <ul className="grid gap-3">
          {sheet.rows.map(({ student, finalGrade, result, exams, outcome }) => {
            const name = `${student.lastName}, ${student.firstName}`;
            return (
              <li key={student.id} className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/students/${student.id}`} className="font-extrabold hover:underline">
                      {name}
                    </Link>
                    <p className="text-sm">
                      {t("finalGrade")}:{" "}
                      {finalGrade === null ? (
                        "—"
                      ) : (
                        <span className={isPassing(finalGrade, { ...DEFAULT_RULES, passMark }) ? "font-bold" : "font-bold text-destructive"}>
                          {formatGrade(finalGrade, locale)}
                        </span>
                      )}
                      {" · "}
                      <ResultLabel result={result} />
                    </p>
                  </div>
                  <OutcomeSelect
                    classId={id}
                    studentId={student.id}
                    studentName={name}
                    current={outcome}
                    options={options}
                  />
                </div>
                <StudentExams
                  classId={id}
                  studentId={student.id}
                  studentName={name}
                  exams={exams}
                  owed={result.kind === "owed"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
