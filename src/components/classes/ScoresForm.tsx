"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { cn } from "cn";
import { saveTaskScores, type ScoresState } from "@/app/(app)/classes/[id]/actions";
import { Initials } from "@/components/Initials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ScoreStatus } from "@/lib/scoresForm";

export type ScoreFormRow = {
  studentId: string;
  name: string;
  firstName: string;
  lastName: string;
  /** What is saved now, already written in the teacher's language (`7,5`). */
  score: string;
  status: ScoreStatus;
  notes: string;
  /** SCORE-5: null when there is no saved score. */
  passing: boolean | null;
  /** ADAPT-1: what is adapted for this student, or null. */
  adaptation: string | null;
  /** ADAPT-4: whether the score starts marked as adapted. */
  adapted: boolean;
};

type State = ScoresState & { version: number };

/** The sheet's columns from `lg` up; below that each student is a small card. */
const columns = (showAdapted: boolean) =>
  showAdapted
    ? "lg:grid-cols-[minmax(10rem,1.3fr)_4.5rem_8.5rem_minmax(8rem,2fr)_5rem_7rem]"
    : "lg:grid-cols-[minmax(10rem,1.3fr)_4.5rem_8.5rem_minmax(8rem,2fr)_7rem]";
const head = "text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase";

/** SCORE-1..5: every student of the course, one save for all. */
export function ScoresForm({ classId, taskId, rows }: { classId: string; taskId: string; rows: ScoreFormRow[] }) {
  const t = useTranslations("classPage.scoring");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => ({ ...(await saveTaskScores(prev, formData)), version: prev.version + 1 }),
    { status: "idle", version: 0 },
  );
  // After an error the fields refill with what was typed; otherwise with what is saved.
  const typed = state.status === "error" ? state.values : undefined;
  const anyAdapted = rows.some((r) => r.adaptation !== null);

  return (
    <form key={state.version} action={formAction} className="grid">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="taskId" value={taskId} />

      <div className={cn("hidden gap-x-3 border-y bg-muted px-5 py-3 lg:grid", columns(anyAdapted))} aria-hidden>
        <span className={head}>{t("student")}</span>
        <span className={head}>{t("score")}</span>
        <span className={head}>{t("status")}</span>
        <span className={head}>{t("notes")}</span>
        {anyAdapted && <span className={cn(head, "text-center")}>{t("adapted")}</span>}
        <span />
      </div>
      <ul className="divide-y border-t lg:border-t-0">
        {rows.map((row) => (
          <ScoreRowFields
            key={row.studentId}
            row={row}
            typed={typed}
            showAdapted={anyAdapted}
            error={state.scoreErrors?.[row.studentId]}
          />
        ))}
      </ul>

      {/* The save bar stays in view while scrolling a long sheet; on a phone it sits above the menu bar (NAV-1). */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 m-3 flex flex-wrap items-center gap-3 rounded-2xl bg-card/95 p-3 shadow-lg ring-1 ring-border backdrop-blur md:bottom-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
        {state.status === "saved" && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Check className="size-4 text-highlight" aria-hidden />
            {t("saved")}
          </p>
        )}
        {state.scoreErrors && (
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

function ScoreRowFields({
  row,
  typed,
  showAdapted,
  error,
}: {
  row: ScoreFormRow;
  typed: Record<string, string> | undefined;
  showAdapted: boolean;
  error: string | undefined;
}) {
  const tAdapt = useTranslations("adaptations");
  const t = useTranslations("classPage.scoring");
  const id = row.studentId;
  const initialStatus = (typed?.[`status.${id}`] as ScoreStatus | undefined) ?? row.status;
  // The score box only applies to a "graded" row; the others have no score (SCORE-2).
  const [status, setStatus] = useState<ScoreStatus>(initialStatus);
  const verdict = row.passing !== null && status === "graded" && !typed ? row.passing : null;
  // On a phone each field gets a small caption; from `lg` the sheet's header names them.
  const caption = "mb-1 block text-xs text-muted-foreground lg:hidden";

  return (
    <li
      className={cn(
        "grid grid-cols-2 items-start gap-x-3 gap-y-3 px-5 py-4 lg:items-center lg:py-3",
        columns(showAdapted),
        verdict === false && "bg-alert-soft/60",
      )}
    >
      <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
        <Initials
          firstName={row.firstName}
          lastName={row.lastName}
          className={cn("size-9", row.adaptation && "bg-alert-soft text-destructive")}
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={`score-${id}`} className="block font-bold">
            {row.lastName}, <span className="font-normal">{row.firstName}</span>
          </label>
          {row.adaptation && (
            <Badge tone="alert" title={row.adaptation} className="mt-0.5">
              {tAdapt("badge")}
            </Badge>
          )}
        </div>
        {/* SCORE-5: on a phone the verdict sits by the name. */}
        {verdict !== null && <Verdict passing={verdict} className="lg:hidden" />}
      </div>
      <div>
        <span aria-hidden className={caption}>
          {t("score")}
        </span>
        <Input
          id={`score-${id}`}
          name={`score.${id}`}
          defaultValue={typed?.[`score.${id}`] ?? row.score}
          inputMode="decimal"
          autoComplete="off"
          disabled={status !== "graded"}
          aria-invalid={!!error}
          className={cn(
            "w-16 text-center text-base font-bold tabular-nums",
            verdict === true && "text-highlight",
            verdict === false && "text-destructive",
          )}
        />
        {error && <p className="mt-1 text-xs text-destructive">{t(`errors.${error}`)}</p>}
      </div>
      <div>
        <span aria-hidden className={caption}>
          {t("status")}
        </span>
        <NativeSelect
          name={`status.${id}`}
          value={status}
          onChange={(e) => setStatus(e.target.value as ScoreStatus)}
          aria-label={t("status")}
          className="w-full"
        >
          <NativeSelectOption value="graded">{t("statuses.graded")}</NativeSelectOption>
          <NativeSelectOption value="missing">{t("statuses.missing")}</NativeSelectOption>
          <NativeSelectOption value="excused">{t("statuses.excused")}</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="col-span-2 lg:col-span-1">
        <span aria-hidden className={caption}>
          {t("notes")}
        </span>
        <Input
          name={`notes.${id}`}
          defaultValue={typed?.[`notes.${id}`] ?? row.notes}
          maxLength={1000}
          aria-label={t("notes")}
          className="w-full"
        />
      </div>
      {showAdapted && (
        <div className={cn("col-span-2 lg:col-span-1 lg:text-center", !row.adaptation && "hidden lg:block")}>
          {row.adaptation && (
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`adapted.${id}`}
                // After an error, ticked only if it was sent ticked.
                defaultChecked={typed ? typed[`adapted.${id}`] !== undefined : row.adapted}
                aria-label={t("adaptedFor", { name: row.name })}
                className="size-4 accent-primary"
              />
              <span aria-hidden className="lg:hidden">
                {t("adapted")}
              </span>
            </label>
          )}
        </div>
      )}
      <div className="hidden justify-self-end lg:block">{verdict !== null && <Verdict passing={verdict} />}</div>
    </li>
  );
}

/** SCORE-5: whether the saved score passes. */
function Verdict({ passing, className }: { passing: boolean; className?: string }) {
  const t = useTranslations("classPage.scoring");
  return (
    <Badge tone={passing ? "accent" : "alert"} dot className={className}>
      {passing ? t("passing") : t("failing")}
    </Badge>
  );
}
