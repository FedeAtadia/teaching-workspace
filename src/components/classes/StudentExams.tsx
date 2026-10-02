import { getLocale, getTranslations } from "next-intl/server";
import { recordExamAction, removeExam } from "@/app/(app)/classes/[id]/actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { FormDialog } from "@/components/forms/FormDialog";
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
            date: formatDate(result.exam.takenOn, locale),
            grade: formatGrade(result.exam.value, locale),
          })}
        </span>
      );
    case "owed":
      return <span className="font-bold text-destructive">{t("owed")}</span>;
  }
}

/**
 * EXAM-1, EXAM-2: a student's exams for one class, each deletable, and the
 * button to record one while the class is owed.
 */
export async function StudentExams({
  classId,
  studentId,
  studentName,
  exams,
  owed,
}: {
  classId: string;
  studentId: string;
  studentName: string;
  exams: ExamRow[];
  owed: boolean;
}) {
  const t = await getTranslations("exams");
  const locale = await getLocale();
  if (exams.length === 0 && !owed) return null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {exams.map((e) => (
        <span
          key={e.id}
          title={e.notes ?? undefined}
          className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-0.5 pl-3 tabular-nums"
        >
          {formatDate(e.takenOn, locale)} ·{" "}
          {e.status === "absent" || e.value === null ? t("absent") : formatGrade(e.value, locale)}
          <ConfirmDeleteButton
            iconOnly
            label={t("delete")}
            title={t("deleteTitle", { date: formatDate(e.takenOn, locale), name: studentName })}
            body={t("deleteBody")}
            action={removeExam.bind(null, { classId, examId: e.id })}
          />
        </span>
      ))}
      {owed && (
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
      )}
    </div>
  );
}

