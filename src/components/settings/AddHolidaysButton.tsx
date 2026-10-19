"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { addHolidaysAction, type AddHolidaysState } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";

/** CAL-3: adds the year's national holidays, then says how many were new. */
export function AddHolidaysButton({ calendarId, year }: { calendarId: string; year: string }) {
  const t = useTranslations("calendar.holidays");
  const [state, formAction, pending] = useActionState<AddHolidaysState, FormData>(addHolidaysAction, {
    status: "idle",
  });
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="calendarId" value={calendarId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? t("adding") : t("add")}
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {state.status === "saved" && t("added", { count: state.added })}
        {state.status === "error" && (state.error === "noList" ? t("noList", { year }) : t("failed"))}
      </p>
    </form>
  );
}
