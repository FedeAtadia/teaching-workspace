import { CalendarDays } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { recordExamAction, removeExam } from "@/app/(app)/classes/[id]/actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { FormDialog } from "@/components/forms/FormDialog";
import { Badge } from "@/components/ui/badge";
import type { ExamRow } from "@/db/queries/yearEnd";
import { formatDate, formatGrade } from "@/lib/format";
import type { ClassResult } from "@/lib/yearEnd";

/** YEAR-1: a class's result for one student, in words. */
export async function ResultLabel({ result }: { result: ClassResult }) {
  const t = await getTranslations("closing.results");
  const locale = await getLocale();
  switch (result.kind) {
    case "pending":
      return <span className="text-muted-foreground">{t("pending")}</span>;
    case "passed":
      return <span className="font-bold">{t("passed")}</span>;
    case "passedByExam":
      return (
        <span className="font-bold">
          {t("passedByExam", {
            date: formatDate(result.exam.takenOn),
            grade: formatGrade(result.exam.value, locale),
          })}
        </span>
      );
    case "owed":
      return <span className="font-bold text-destructive">{t("owed")}</span>;
  }
}

type ExamProps = {
  classId: string;
  studentId: string;
  studentName: string;
};

/** EXAM-1: the button that records an exam for a class the student owes. */
export async function RecordExamButton({ classId, studentId, studentName }: ExamProps) {
  const t = await getTranslations("exams");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <FormDialog
      trigger="addSmall"
      triggerLabel={t("record")}
      title={t("recordTitle", { name: studentName })}
      action={recordExamAction}
      hidden={{ classId, studentId }}
      formErrors={{ notOwed: t("errors.notOwed"), notFound: t("errors.notFound") }}
      fields={[
        { kind: "date", name: "takenOn", label: t("fields.takenOn"), defaultValue: today },
        {
          kind: "select",
          name: "status",
          label: t("fields.status"),
          options: [
            { value: "graded", label: t("fields.graded") },
            { value: "absent", label: t("absent") },
          ],
          defaultValue: "graded",
        },
        { kind: "text", name: "grade", label: t("fields.grade"), maxLength: 5, placeholder: "7" },
        { kind: "textarea", name: "notes", label: t("fields.notes"), maxLength: 1000, rows: 2 },
      ]}
    />
  );
}

/**
 * EXAM-2: a student's exams for one class as tinted strips (date, result,
 * observaciones), each deletable. While the class is `owed`, every grade in
 * it failed, so grades show in red.
 */
export async function ExamList({
  classId,
  studentName,
  exams,
  owed,
}: Omit<ExamProps, "studentId"> & { exams: ExamRow[]; owed: boolean }) {
  const t = await getTranslations("exams");
  const locale = await getLocale();
  if (exams.length === 0) return null;
  return (
    <ul className="grid gap-2">
      {exams.map((e) => {
        const absent = e.status === "absent" || e.value === null;
        return (
          <li
            key={e.id}
            className="flex items-start gap-3 rounded-xl bg-muted/60 py-2 pr-2 pl-3 text-sm sm:items-center sm:pl-4"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              <span className="flex shrink-0 items-center gap-2 py-1">
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                <span className="font-semibold tabular-nums">{formatDate(e.takenOn)}</span>
                {absent ? (
                  <Badge>{t("absent")}</Badge>
                ) : (
                  <Badge tone={owed ? "alert" : "neutral"} className="tabular-nums">
                    {t("gradeBadge", { grade: formatGrade(e.value!, locale) })}
                  </Badge>
                )}
              </span>
              {e.notes && <p className="min-w-0 text-muted-foreground">{e.notes}</p>}
            </div>
            <ConfirmDeleteButton
              iconOnly
              label={t("delete")}
              title={t("deleteTitle", { date: formatDate(e.takenOn), name: studentName })}
              body={t("deleteBody")}
              action={removeExam.bind(null, { classId, examId: e.id })}
            />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * EXAM-1, EXAM-2: a student's exams for one class, each deletable, and the
 * button to record one while the class is owed. Previas lays out the two
 * parts itself; Cierre uses them together through this.
 */
export async function StudentExams({
  classId,
  studentId,
  studentName,
  exams,
  owed,
}: ExamProps & { exams: ExamRow[]; owed: boolean }) {
  const t = await getTranslations("exams");
  if (exams.length === 0 && !owed) return null;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {exams.length > 0 && <ExamsLabel>{t("history")}</ExamsLabel>}
        {owed && <RecordExamButton classId={classId} studentId={studentId} studentName={studentName} />}
      </div>
      <ExamList classId={classId} studentName={studentName} exams={exams} owed={owed} />
    </div>
  );
}

/** The small uppercase label over a student's exams: "Exámenes anteriores". */
export function ExamsLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:text-xs">
      {children}
    </p>
  );
}
