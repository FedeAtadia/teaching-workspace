"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setOutcomeAction } from "@/app/(app)/classes/[id]/actions";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { YearOutcome } from "@/lib/yearEnd";

/** YEAR-2: one student's year outcome, saved as soon as it is picked. */
export function OutcomeSelect({
  classId,
  studentId,
  studentName,
  current,
  options,
}: {
  classId: string;
  studentId: string;
  studentName: string;
  current: YearOutcome | null;
  /** The outcomes the course's year allows (YEAR-2). */
  options: YearOutcome[];
}) {
  const t = useTranslations("closing");
  const [value, setValue] = useState(current ?? "");
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        value={value}
        disabled={pending}
        aria-label={t("outcomeFor", { name: studentName })}
        onChange={(e) => {
          const next = e.target.value;
          const before = value;
          setValue(next);
          startTransition(async () => {
            const result = await setOutcomeAction({ classId, studentId, outcome: next });
            setState(result.ok ? "saved" : "failed");
            if (!result.ok) setValue(before);
          });
        }}
        size="sm"
      >
        <NativeSelectOption value="">{t("undecided")}</NativeSelectOption>
        {options.map((o) => (
          <NativeSelectOption key={o} value={o}>
            {t(`outcomes.${o}`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <span role="status" className="text-xs text-muted-foreground">
        {pending ? t("saving") : state === "saved" ? t("saved") : ""}
      </span>
      {state === "failed" && (
        <span role="alert" className="text-xs text-destructive">
          {t("failed")}
        </span>
      )}
    </div>
  );
}
