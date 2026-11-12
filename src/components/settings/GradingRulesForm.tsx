"use client";

import { CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { saveRulesAction, type RulesState } from "@/app/(app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGrade } from "@/lib/format";
import type { GradingRules } from "@/lib/grading";

const FIELDS = ["gradeMin", "gradeMax", "passMark", "maxTermIncrease", "maxTermDecrease"] as const;

/** GRADE-4: the teacher's scale, pass mark and how far the 2° cuatrimestre may move from the 1°. */
export function GradingRulesForm({ current }: { current: GradingRules }) {
  const t = useTranslations("settings.grading");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<RulesState, FormData>(saveRulesAction, { status: "idle" });

  const error = (field: (typeof FIELDS)[number]) => {
    const problem = state.ruleErrors?.[field];
    if (problem) return t(`problems.${problem}`);
    const key = state.fieldErrors?.[field];
    return key ? tErr(key) : undefined;
  };

  return (
    <form action={formAction} className="grid gap-4">
      <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((field) => {
          const message = error(field);
          return (
            <div key={field} className="grid content-start gap-1.5">
              <label htmlFor={`rules-${field}`} className="text-sm font-bold">
                {t(`fields.${field}`)}
              </label>
              <Input
                id={`rules-${field}`}
                name={field}
                inputMode="decimal"
                // Shown as grades are everywhere: 7,5 in es-AR.
                defaultValue={state.values?.[field] ?? formatGrade(current[field], locale)}
                aria-invalid={!!message}
                aria-describedby={`rules-${field}-hint`}
                className="h-10 w-28 rounded-xl bg-muted text-lg font-semibold tabular-nums"
              />
              <p id={`rules-${field}-hint`} className={message ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
                {message ?? t(`hints.${field}`)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
        <p role="status" className="text-sm">
          {state.status === "saved" && (
            <Badge tone="accent">
              <CircleCheck aria-hidden />
              {t("saved")}
            </Badge>
          )}
        </p>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">{t("note")}</p>
    </form>
  );
}
