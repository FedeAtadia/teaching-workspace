import { CircleAlert, CircleCheck, CircleHelp, PencilLine } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "cn";
import { Initials } from "@/components/Initials";
import { OutcomeSelect } from "@/components/classes/OutcomeSelect";
import { ResultLabel, StudentExams } from "@/components/classes/StudentExams";
import { Badge } from "@/components/ui/badge";
import { getAdaptations } from "@/db/queries/adaptations";
import { getClosingSheet } from "@/db/queries/yearEnd";
import { formatGrade } from "@/lib/format";
import { isPassing } from "@/lib/grading";
import { allowedOutcomes, type ClassResult } from "@/lib/yearEnd";
import { loadClass } from "../data";

// One card per student; from lg up the cards line up as table rows under one header.
const COLUMNS = "lg:grid-cols-[minmax(0,1.4fr)_6rem_minmax(0,1.3fr)_minmax(0,1fr)]";
const HEAD = "text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase";

const RESULT_TONE: Record<ClassResult["kind"], "neutral" | "accent" | "alert"> = {
  pending: "neutral",
  passed: "accent",
  passedByExam: "accent",
  owed: "alert",
};
const RESULT_ICON = { pending: CircleHelp, passed: CircleCheck, passedByExam: CircleCheck, owed: CircleAlert };

/** YEAR-1..3, EXAM-1, EXAM-2 */
export default async function ClosingPage({ params }: PageProps<"/classes/[id]/closing">) {
  const { id } = await params;
  const { db, teacherId, cls, rules } = await loadClass(id);
  const [sheet, adaptations] = await Promise.all([
    getClosingSheet(db, teacherId, cls),
    getAdaptations(db, teacherId, id),
  ]);
  const t = await getTranslations("closing");
  const tAdapt = await getTranslations("adaptations");
  const locale = await getLocale();
  const options = allowedOutcomes(cls.year);
  // Shown before each value on a phone; from lg up the header row says it.
  const label = "text-xs font-semibold text-muted-foreground lg:sr-only";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="max-w-prose text-sm text-muted-foreground">{t(cls.year >= 6 ? "introLast" : "intro")}</p>
        <Link
          href={`/classes/${id}/term-grades?term=2`}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <PencilLine className="size-4" aria-hidden />
          {t("toFinalGrades")}
        </Link>
      </div>

      {sheet.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
      ) : (
        <div className="grid gap-2">
          {/* The column titles; each card also names its values for screen readers. */}
          <div aria-hidden className={cn("hidden gap-x-4 px-6 pl-7 lg:grid", COLUMNS)}>
            <span className={HEAD}>{t("student")}</span>
            <span className={HEAD}>{t("finalGrade")}</span>
            <span className={HEAD}>{t("result")}</span>
            <span className={HEAD}>{t("outcome")}</span>
          </div>
          <ul className="grid gap-3">
            {sheet.rows.map(({ student, finalGrade, result, exams, outcome }) => {
              const name = `${student.lastName}, ${student.firstName}`;
              const owed = result.kind === "owed";
              const failing = finalGrade !== null && !isPassing(finalGrade, rules);
              const adaptation = adaptations.get(student.id);
              const Icon = RESULT_ICON[result.kind];
              return (
                <li
                  key={student.id}
                  className={cn(
                    "relative grid gap-4 overflow-hidden rounded-2xl bg-card p-4 pl-5 ring-1 ring-border sm:px-6 sm:pl-7",
                    "lg:items-center lg:gap-x-4",
                    COLUMNS,
                  )}
                >
                  {/* The red edge, as on Previas: the class is owed. */}
                  {owed && <span className="absolute inset-y-0 left-0 w-1 bg-alert" aria-hidden />}

                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <Initials
                      firstName={student.firstName}
                      lastName={student.lastName}
                      className={owed ? "bg-alert-soft text-destructive" : undefined}
                    />
                    <Link href={`/students/${student.id}`} className="min-w-0 font-bold hover:underline">
                      {student.lastName}, <span className="font-normal">{student.firstName}</span>
                    </Link>
                    {/* ADAPT-1 */}
                    {adaptation && (
                      <Badge tone="accent" title={adaptation}>
                        {tAdapt("badge")}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 lg:contents">
                    <p className="flex items-center gap-2">
                      <span className={label}>{t("finalGrade")}</span>
                      <span
                        className={cn(
                          "inline-flex min-w-10 justify-center rounded-lg px-2 py-1 font-bold tabular-nums",
                          finalGrade === null
                            ? "bg-muted text-muted-foreground"
                            : failing
                              ? "bg-alert-soft text-destructive"
                              : "bg-highlight-soft text-highlight",
                        )}
                      >
                        {finalGrade === null ? "—" : formatGrade(finalGrade, locale)}
                      </span>
                    </p>
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="sr-only">{t("result")}: </span>
                      <Badge tone={RESULT_TONE[result.kind]} className="py-1 whitespace-normal">
                        <Icon aria-hidden />
                        <ResultLabel result={result} />
                      </Badge>
                    </p>
                  </div>

                  <OutcomeSelect
                    classId={id}
                    studentId={student.id}
                    studentName={name}
                    current={outcome}
                    options={options}
                  />

                  {(exams.length > 0 || owed) && (
                    <div className="border-t pt-4 lg:col-span-full">
                      <StudentExams
                        classId={id}
                        studentId={student.id}
                        studentName={name}
                        exams={exams}
                        owed={owed}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
