"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { saveFollowUpAction } from "@/app/(app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FOLLOW_UP_MISSING_RANGE } from "@/lib/followUp";
import type { FormState } from "@/lib/formState";

/** FOLLOW-4: whether students to follow up are pointed out, and from how many tasks not handed in. */
export function FollowUpForm({ current }: { current: { enabled: boolean; missing: number } }) {
  const t = useTranslations("settings.followUp");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveFollowUpAction, { status: "idle" });
  const error = state.fieldErrors?.missing;
  // After a submit the fields refill from what was sent; an unticked box sends nothing.
  const enabled = state.values ? state.values.enabled === "on" : current.enabled;

  return (
    <form action={formAction} className="grid gap-4">
      <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
      <label className="flex items-center gap-2.5 text-sm font-bold">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-4 accent-primary" />
        {t("enabled")}
      </label>
      <div className="grid gap-1.5">
        <label htmlFor="follow-up-missing" className="text-sm font-bold">
          {t("missing")}
        </label>
        <Input
          id="follow-up-missing"
          name="missing"
          type="number"
          inputMode="numeric"
          min={FOLLOW_UP_MISSING_RANGE.min}
          max={FOLLOW_UP_MISSING_RANGE.max}
          step={1}
          defaultValue={state.values?.missing ?? current.missing}
          aria-invalid={!!error}
          className="h-10 w-24 rounded-xl bg-muted text-lg font-semibold tabular-nums"
        />
        <p className={error ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
          {error ? tErr(error) : t("missingHint")}
        </p>
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
    </form>
  );
}
