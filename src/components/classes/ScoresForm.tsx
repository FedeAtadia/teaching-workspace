"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { saveTaskScores, type ScoresState } from "@/app/(app)/classes/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ScoreStatus } from "@/lib/scoresForm";

export type ScoreFormRow = {
  studentId: string;
  name: string;
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
    <form key={state.version} action={formAction} className="grid gap-4">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="taskId" value={taskId} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">{t("student")}</th>
              <th className="py-2 pr-3 font-medium">{t("score")}</th>
              <th className="py-2 pr-3 font-medium">{t("status")}</th>
              {anyAdapted && <th className="py-2 pr-3 font-medium">{t("adapted")}</th>}
              <th className="py-2 font-medium">{t("notes")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ScoreRowFields
                key={row.studentId}
                row={row}
                typed={typed}
                showAdapted={anyAdapted}
                error={state.scoreErrors?.[row.studentId]}
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

  return (
    <tr className="border-b align-top last:border-0">
      <td className="py-2 pr-3 font-medium whitespace-nowrap">
        <label htmlFor={`score-${id}`}>{row.name}</label>
        {row.adaptation && (
          <span
            title={row.adaptation}
            className="ml-1.5 inline-block rounded-full bg-primary/15 px-2 py-0.5 align-middle text-[0.7rem] font-bold text-chalk"
          >
            {tAdapt("badge")}
          </span>
        )}
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <Input
            id={`score-${id}`}
            name={`score.${id}`}
            defaultValue={typed?.[`score.${id}`] ?? row.score}
            inputMode="decimal"
            autoComplete="off"
            disabled={status !== "graded"}
            aria-invalid={!!error}
            className="w-16 text-center tabular-nums"
          />
          {row.passing !== null && status === "graded" && !typed && (
            <span
              className={row.passing ? "text-xs text-muted-foreground" : "text-xs font-medium text-destructive"}
            >
              {row.passing ? t("passing") : t("failing")}
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{t(`errors.${error}`)}</p>}
      </td>
      <td className="py-2 pr-3">
        <NativeSelect
          name={`status.${id}`}
          value={status}
          onChange={(e) => setStatus(e.target.value as ScoreStatus)}
          aria-label={t("status")}
          size="sm"
        >
          <NativeSelectOption value="graded">{t("statuses.graded")}</NativeSelectOption>
          <NativeSelectOption value="missing">{t("statuses.missing")}</NativeSelectOption>
          <NativeSelectOption value="excused">{t("statuses.excused")}</NativeSelectOption>
        </NativeSelect>
      </td>
      {showAdapted && (
        <td className="py-2 pr-3 text-center">
          {row.adaptation && (
            <input
              type="checkbox"
              name={`adapted.${id}`}
              // After an error, ticked only if it was sent ticked.
              defaultChecked={typed ? typed[`adapted.${id}`] !== undefined : row.adapted}
              aria-label={t("adaptedFor", { name: row.name })}
              className="size-4 accent-primary"
            />
          )}
        </td>
      )}
      <td className="py-2">
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
