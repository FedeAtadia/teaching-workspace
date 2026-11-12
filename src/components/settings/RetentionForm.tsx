"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { saveRetentionAction } from "@/app/(app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { FormState } from "@/lib/formState";
import { RETENTION_OPTIONS } from "@/lib/retention";

/** KEEP-2: how long a graduate who owes nothing is kept. */
export function RetentionForm({ current }: { current: number }) {
  const t = useTranslations("settings.data.retention");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveRetentionAction, { status: "idle" });
  const error = state.fieldErrors?.months;
  return (
    <form action={formAction} className="grid gap-2.5">
      <label htmlFor="graduate-retention" className="text-sm font-bold">
        {t("label")}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect
          id="graduate-retention"
          name="months"
          defaultValue={state.values?.months ?? String(current)}
          aria-invalid={!!error}
          className="w-40"
        >
          {RETENTION_OPTIONS.map((months) => (
            <NativeSelectOption key={months} value={months}>
              {t("months", { count: months })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
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
