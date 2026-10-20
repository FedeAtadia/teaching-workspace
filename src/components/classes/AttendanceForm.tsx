"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  saveAttendanceAction,
  saveNoClassAction,
  type AttendanceState,
} from "@/app/(app)/classes/[id]/attendance/actions";
import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ATTENDANCE_STATUSES, SESSION_REASONS, type AttendanceStatus, type SessionReason } from "@/lib/attendance";

export type AttendanceFormRow = { studentId: string; name: string; status: AttendanceStatus | null };

/** The checked pill of each mark. */
const CHECKED: Record<AttendanceStatus, string> = {
  present: "peer-checked:bg-primary peer-checked:text-primary-foreground",
  absent: "peer-checked:bg-destructive peer-checked:text-background",
  late: "peer-checked:bg-foreground peer-checked:text-background",
  excused: "peer-checked:bg-muted-foreground peer-checked:text-background",
};

/** ATT-2: one row per student, four marks each; a student with nothing saved starts as presente. */
export function AttendanceForm({ classId, date, rows }: { classId: string; date: string; rows: AttendanceFormRow[] }) {
  const t = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<AttendanceState, FormData>(saveAttendanceAction, {
    status: "idle",
  });

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="date" value={date} />
      <ul className="divide-y rounded-2xl bg-card ring-1 ring-border">
        {rows.map((row) => (
          <li key={row.studentId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
            <span className="font-bold">{row.name}</span>
            <fieldset className="flex gap-1.5">
              <legend className="sr-only">{row.name}</legend>
              {ATTENDANCE_STATUSES.map((status) => (
                <label key={status} title={t(`statuses.${status}`)} className="cursor-pointer">
                  <input
                    type="radio"
                    name={`mark.${row.studentId}`}
                    value={status}
                    defaultChecked={(row.status ?? "present") === status}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex h-9 min-w-9 items-center justify-center rounded-full bg-muted px-2.5 text-sm font-bold text-muted-foreground transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 ${CHECKED[status]}`}
                  >
                    <span aria-hidden>{t(`short.${status}`)}</span>
                    <span className="sr-only">{t(`statuses.${status}`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : t("day.save")}
        </Button>
        <p role="status" className="text-sm">
          {state.status === "saved" && <span className="text-muted-foreground">{t("day.saved")}</span>}
          {state.status === "error" && <span className="text-destructive">{t("day.failed")}</span>}
        </p>
      </div>
    </form>
  );
}

/** ATT-3: the day saved as not held, with its reason. */
export function NoClassForm({
  classId,
  date,
  current,
}: {
  classId: string;
  date: string;
  current: { reason: SessionReason | null; note: string | null } | null;
}) {
  const t = useTranslations("attendance");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<AttendanceState, FormData>(saveNoClassAction, {
    status: "idle",
  });
  const v = state.values ?? {};
  const noteError = state.fieldErrors?.note;

  return (
    <form action={formAction} className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="date" value={date} />
      <h2 className="font-bold">{t("day.noClass.title")}</h2>
      <Field id="no-class-reason" label={t("day.noClass.reason")}>
        <NativeSelect
          id="no-class-reason"
          name="reason"
          defaultValue={v.reason ?? current?.reason ?? "weather"}
          className="w-full"
        >
          {SESSION_REASONS.map((r) => (
            <NativeSelectOption key={r} value={r}>
              {t(`reasons.${r}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field id="no-class-note" label={t("day.noClass.note")} error={noteError ? tErr(noteError) : undefined}>
        <textarea
          id="no-class-note"
          name="note"
          rows={2}
          maxLength={500}
          defaultValue={v.note ?? current?.note ?? ""}
          aria-invalid={!!noteError}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
        />
      </Field>
      <p className="text-xs text-muted-foreground">{t("day.noClass.warning")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? tCommon("saving") : t("day.noClass.save")}
        </Button>
        {state.status === "error" && state.formError && (
          <p role="alert" className="text-sm text-destructive">
            {t("day.failed")}
          </p>
        )}
      </div>
    </form>
  );
}
