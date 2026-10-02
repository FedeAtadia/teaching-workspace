"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { saveTermGradesAction, type TermGradesState } from "@/app/(app)/classes/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGrade } from "@/lib/format";
import { checkSecondTermGrade, isPassing, parseGrade, secondTermRange, type GradingRules } from "@/lib/grading";
import type { Suggestion } from "@/lib/grading";

export type TermGradeFormRow = {
  studentId: string;
  name: string;
  suggestion: Suggestion;
  /** What is saved now, already written in the teacher's language (`7,5`). */
  grade: string;
  notes: string;
  reason: string;
  /** TERM-6: the 1° grade, on the 2° cuatrimestre only. */
  firstTerm: number | null;
};

type State = TermGradesState & { version: number };

/** TERM-5, TERM-6: every student of the course, one save for all. */
export function TermGradesForm({
  classId,
  termId,
  second,
  rules,
  rows,
}: {
  classId: string;
  termId: string;
  /** The 2° cuatrimestre: shows the 1° grade and its range. */
  second: boolean;
  rules: GradingRules;
  rows: TermGradeFormRow[];
}) {
  const t = useTranslations("classPage.termGrades");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => ({ ...(await saveTermGradesAction(prev, formData)), version: prev.version + 1 }),
    { status: "idle", version: 0 },
  );
  // After an error the fields refill with what was typed; otherwise with what is saved.
  const typed = state.status === "error" ? state.values : undefined;

  return (
    <form key={state.version} action={formAction} className="grid gap-4">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="termId" value={termId} />

      <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted text-left">
              <th className="px-4 py-3 font-bold">{t("student")}</th>
              <th className="px-3 py-3 text-center font-medium">{t("suggested")}</th>
              {second && <th className="px-3 py-3 text-center font-medium">{t("firstTerm")}</th>}
              <th className="px-3 py-3 font-medium">{t("grade")}</th>
              <th className="px-3 py-3 font-medium">{t("notes")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <GradeRow
                key={row.studentId}
                row={row}
                second={second}
                rules={rules}
                typed={typed}
                error={state.gradeErrors?.[row.studentId]}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
        {state.status === "saved" && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("saved")}
          </p>
        )}
        {state.gradeErrors && (
          <p role="alert" className="text-sm text-destructive">
            {t("fixErrors")}
          </p>
        )}
        {state.formError && (
          <p role="alert" className="text-sm text-destructive">
            {t("notFound")}
          </p>
        )}
      </div>
    </form>
  );
}

function GradeRow({
  row,
  second,
  rules,
  typed,
  error,
}: {
  row: TermGradeFormRow;
  second: boolean;
  rules: GradingRules;
  typed: Record<string, string> | undefined;
  error: string | undefined;
}) {
  const t = useTranslations("classPage.termGrades");
  const tGrades = useTranslations("classPage.grades");
  const locale = useLocale();
  const id = row.studentId;
  const [grade, setGrade] = useState(typed?.[`grade.${id}`] ?? row.grade);

  // TERM-6, checked as the teacher types; the server checks it again on save.
  const value = parseGrade(grade, rules);
  const range = row.firstTerm !== null ? secondTermRange(row.firstTerm, rules) : null;
  const check = value !== null && row.firstTerm !== null ? checkSecondTermGrade(value, row.firstTerm, rules) : null;
  const outside = check === "above" || check === "below";
  const { suggestion } = row;

  return (
    <tr className="border-b align-top last:border-0">
      <td className="px-4 py-2.5 font-bold whitespace-nowrap">
        <label htmlFor={`grade-${id}`}>{row.name}</label>
      </td>
      <td className="px-3 py-2.5 text-center whitespace-nowrap tabular-nums">
        {suggestion.average === null ? "—" : formatGrade(suggestion.average, locale)}
        {suggestion.missing > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">
            ({suggestion.missing} {tGrades("missingShort")})
          </span>
        )}
      </td>
      {second && (
        <td className="px-3 py-2.5 text-center whitespace-nowrap tabular-nums">
          {row.firstTerm === null || range === null ? (
            "—"
          ) : (
            <>
              {formatGrade(row.firstTerm, locale)}
              <span className="block text-xs text-muted-foreground">
                {t("range", { min: formatGrade(range.min, locale), max: formatGrade(range.max, locale) })}
              </span>
            </>
          )}
        </td>
      )}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Input
            id={`grade-${id}`}
            name={`grade.${id}`}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!!error}
            className="w-16 text-center tabular-nums"
          />
          {value !== null && (
            <span
              className={
                isPassing(value, rules) ? "text-xs text-muted-foreground" : "text-xs font-medium text-destructive"
              }
            >
              {isPassing(value, rules) ? t("passing") : t("failing")}
            </span>
          )}
        </div>
        {outside && (
          <div className="mt-2 grid gap-1">
            <label htmlFor={`reason-${id}`} className="text-xs font-medium text-chalk">
              {t(check === "above" ? "above" : "below")}
            </label>
            <Input
              id={`reason-${id}`}
              name={`reason.${id}`}
              defaultValue={typed?.[`reason.${id}`] ?? row.reason}
              maxLength={500}
              placeholder={t("reasonPlaceholder")}
              aria-invalid={error === "reasonRequired" || error === "reasonTooLong"}
              className="min-w-48"
            />
          </div>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{t(`errors.${error}`)}</p>}
      </td>
      <td className="px-3 py-2">
        <Input
          name={`notes.${id}`}
          defaultValue={typed?.[`notes.${id}`] ?? row.notes}
          maxLength={1000}
          aria-label={t("notes")}
          className="min-w-48"
        />
      </td>
    </tr>
  );
}
