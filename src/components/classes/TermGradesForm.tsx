"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { cn } from "cn";
import { saveTermGradesAction, type TermGradesState } from "@/app/(app)/classes/[id]/actions";
import { Initials } from "@/components/Initials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGrade } from "@/lib/format";
import { checkSecondTermGrade, isPassing, parseGrade, secondTermRange, type GradingRules } from "@/lib/grading";
import type { Suggestion } from "@/lib/grading";

export type TermGradeFormRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  /** ADAPT-1: what is adapted for this student, if anything. */
  adaptation: string | null;
  suggestion: Suggestion;
  /** SUGGEST-3: the attendance %, when below the teacher's minimum. */
  lowAttendance: number | null;
  /** What is saved now, already written in the teacher's language (`7,5`). */
  grade: string;
  notes: string;
  reason: string;
  /** TERM-6: the 1° grade, on the 2° cuatrimestre only. */
  firstTerm: number | null;
};

type State = TermGradesState & { version: number };

// One row per student: a card on a phone, a table row from lg up. The header
// row and every row share these columns.
const COLUMNS = "lg:grid-cols-[minmax(0,1.5fr)_7rem_minmax(10rem,0.9fr)_minmax(0,1.3fr)]";
const COLUMNS_SECOND = "lg:grid-cols-[minmax(0,1.5fr)_7rem_7rem_minmax(10rem,0.9fr)_minmax(0,1.3fr)]";
const HEAD = "text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase";

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
  const columns = second ? COLUMNS_SECOND : COLUMNS;

  return (
    <form key={state.version} action={formAction} className="grid gap-4">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="termId" value={termId} />

      <div className="lg:overflow-hidden lg:rounded-2xl lg:bg-card lg:ring-1 lg:ring-border">
        {/* The column titles; each row also names its values for screen readers. */}
        <div aria-hidden className={cn("hidden gap-x-4 border-b bg-muted px-5 py-3 lg:grid", columns)}>
          <span className={HEAD}>{t("student")}</span>
          <span className={HEAD}>{t("suggested")}</span>
          {second && <span className={HEAD}>{t("firstTerm")}</span>}
          <span className={HEAD}>{t("grade")}</span>
          <span className={HEAD}>{t("notes")}</span>
        </div>
        <ul className="grid gap-3 lg:gap-0">
          {rows.map((row) => (
            <GradeRow
              key={row.studentId}
              row={row}
              second={second}
              columns={columns}
              rules={rules}
              typed={typed}
              error={state.gradeErrors?.[row.studentId]}
            />
          ))}
        </ul>
      </div>

      {/* The save bar stays in view while scrolling a long list; on a phone it sits above the menu bar (NAV-1). */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-card/95 p-3 shadow-lg ring-1 ring-border backdrop-blur md:bottom-4">
        <Button type="submit" size="lg" disabled={pending}>
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
  columns,
  rules,
  typed,
  error,
}: {
  row: TermGradeFormRow;
  second: boolean;
  columns: string;
  rules: GradingRules;
  typed: Record<string, string> | undefined;
  error: string | undefined;
}) {
  const t = useTranslations("classPage.termGrades");
  const tGrades = useTranslations("classPage.grades");
  const tAdapt = useTranslations("adaptations");
  const locale = useLocale();
  const id = row.studentId;
  const [grade, setGrade] = useState(typed?.[`grade.${id}`] ?? row.grade);

  // TERM-6, checked as the teacher types; the server checks it again on save.
  const value = parseGrade(grade, rules);
  const range = row.firstTerm !== null ? secondTermRange(row.firstTerm, rules) : null;
  const check = value !== null && row.firstTerm !== null ? checkSecondTermGrade(value, row.firstTerm, rules) : null;
  const outside = check === "above" || check === "below";
  const passing = value !== null && isPassing(value, rules);
  const reasonError = error === "reasonRequired" || error === "reasonTooLong";
  const { suggestion } = row;
  // Shown before each value on a phone; from lg up the header row says it.
  const label = "text-xs text-muted-foreground lg:sr-only";

  return (
    <li
      className={cn(
        "grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border",
        "lg:items-center lg:gap-x-4 lg:rounded-none lg:border-b lg:px-5 lg:py-3 lg:ring-0 lg:last:border-0",
        columns,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <Initials
          firstName={row.firstName}
          lastName={row.lastName}
          className={row.lowAttendance !== null ? "bg-alert-soft text-destructive" : undefined}
        />
        <label htmlFor={`grade-${id}`} className="min-w-0 font-bold">
          {row.lastName}, <span className="font-normal">{row.firstName}</span>
        </label>
        {/* ADAPT-1 */}
        {row.adaptation && (
          <Badge tone="accent" title={row.adaptation}>
            {tAdapt("badge")}
          </Badge>
        )}
      </div>

      {/* A tinted strip on a phone; from lg up its two parts are table cells. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-muted px-3 py-2 text-sm lg:contents">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 tabular-nums">
          <span className={label}>{t("suggested")}:</span>
          {suggestion.average === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className={cn("text-base font-bold", row.lowAttendance !== null && "text-destructive")}>
              {formatGrade(suggestion.average, locale)}
            </span>
          )}
          {suggestion.missing > 0 && (
            <span className="text-xs text-muted-foreground">
              ({suggestion.missing} {tGrades("missingShort")})
            </span>
          )}
          {/* SUGGEST-3: shown as not passing; the number stays. */}
          {row.lowAttendance !== null && (
            <Badge tone="alert" title={tGrades("lowAttendance", { rate: row.lowAttendance })}>
              {tGrades("lowAttendanceShort", { rate: row.lowAttendance })}
            </Badge>
          )}
        </div>
        {second && (
          <div className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums lg:grid">
            <span className={label}>{t("firstTerm")}:</span>
            {row.firstTerm === null || range === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <>
                <span className="font-bold">{formatGrade(row.firstTerm, locale)}</span>
                <span className="text-xs text-muted-foreground">
                  {t("range", { min: formatGrade(range.min, locale), max: formatGrade(range.max, locale) })}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-sm font-semibold lg:hidden">
            {t("grade")}
          </span>
          <Input
            id={`grade-${id}`}
            name={`grade.${id}`}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!!error && !reasonError}
            className={cn(
              "h-10 w-16 text-center text-base font-bold tabular-nums md:text-base",
              value !== null && !passing && "bg-alert-soft text-destructive dark:bg-alert-soft",
            )}
          />
          {value !== null && (
            <Badge tone={passing ? "accent" : "alert"} className="ml-auto lg:ml-0">
              {passing ? t("passing") : t("failing")}
            </Badge>
          )}
        </div>
        {error && !reasonError && <p className="mt-1.5 text-xs text-destructive">{t(`errors.${error}`)}</p>}
      </div>

      <Input
        name={`notes.${id}`}
        defaultValue={typed?.[`notes.${id}`] ?? row.notes}
        maxLength={1000}
        aria-label={t("notes")}
        placeholder={t("notes")}
        className="h-10 bg-muted/60"
      />

      {/* TERM-6: outside the range the reason is asked for, blue above it and red below. */}
      {outside && (
        <div
          className={cn(
            "grid gap-2 rounded-xl p-3 lg:col-span-full",
            check === "above" ? "bg-highlight-soft" : "bg-alert-soft",
          )}
        >
          <label
            htmlFor={`reason-${id}`}
            className={cn(
              "flex items-center gap-1.5 text-sm font-bold",
              check === "above" ? "text-highlight" : "text-destructive",
            )}
          >
            {check === "above" ? (
              <TrendingUp className="size-4" aria-hidden />
            ) : (
              <TrendingDown className="size-4" aria-hidden />
            )}
            {t(check === "above" ? "above" : "below")}
          </label>
          <Input
            id={`reason-${id}`}
            name={`reason.${id}`}
            defaultValue={typed?.[`reason.${id}`] ?? row.reason}
            maxLength={500}
            placeholder={t("reasonPlaceholder")}
            aria-invalid={reasonError}
            className="h-10 bg-card dark:bg-card"
          />
          {reasonError && <p className="text-xs text-destructive">{t(`errors.${error}`)}</p>}
        </div>
      )}
    </li>
  );
}
