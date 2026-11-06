"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { saveMinAttendanceAction } from "@/app/(app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/formState";

/** SUGGEST-3: the minimum attendance %, 0 to turn it off. */
export function MinAttendanceForm({ current }: { current: number }) {
  const t = useTranslations("settings.attendance");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveMinAttendanceAction, {
    status: "idle",
  });
  const error = state.fieldErrors?.minAttendance;
  return (
    <form action={formAction} className="grid gap-2.5">
      <label htmlFor="min-attendance" className="text-sm font-bold">
        {t("minimum")}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          id="min-attendance"
          name="minAttendance"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          defaultValue={state.values?.minAttendance ?? current}
          aria-invalid={!!error}
          className="h-10 w-24 rounded-xl bg-muted text-lg font-semibold tabular-nums"
        />
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
          {error && <span className="text-destructive">{tErr(error)}</span>}
        </p>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">{t("hint")}</p>
    </form>
  );
}
