"use client";

import { CalendarX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useOffline } from "next/offline";
import { useActionState, useState, useTransition } from "react";
import { saveNoClassAction, type AttendanceState } from "@/app/(app)/classes/[id]/attendance/actions";
import { forget, keepMark, queueAndSend, send, useDrafts } from "@/components/attendance/drafts";
import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ATTENDANCE_STATUSES, SESSION_REASONS, type AttendanceStatus, type SessionReason } from "@/lib/attendance";
import { differences, draftKey, type Marks } from "@/lib/offlineAttendance";

export type AttendanceFormRow = { studentId: string; name: string; status: AttendanceStatus | null };

/** The checked square of each mark, in the same colours as the sheet's marks (AttendanceMark), filled. */
const CHECKED: Record<AttendanceStatus, string> = {
  present: "peer-checked:bg-primary peer-checked:text-primary-foreground",
  absent: "peer-checked:bg-alert-deep peer-checked:text-white",
  late: "peer-checked:bg-accent-deep peer-checked:text-white",
  excused: "peer-checked:bg-muted-foreground peer-checked:text-background",
};

/**
 * ATT-2, OFFLINE-1..3: one row per student, four marks each; a student with
 * nothing saved starts as presente. Each mark is kept on the phone as it is
 * tapped, and "Guardar" queues the day there before sending it, so nothing is
 * lost without signal or if the app closes.
 */
export function AttendanceForm({
  teacherId,
  classId,
  date,
  label,
  version,
  rows,
}: {
  teacherId: string;
  classId: string;
  date: string;
  /** How the day reads in a notice: "5° A Matemática · Viernes 13/11". */
  label: string;
  /** OFFLINE-3: the version of the day the rows come from. */
  version: number | null;
  rows: AttendanceFormRow[];
}) {
  const t = useTranslations("attendance");
  const tOff = useTranslations("offline");
  const router = useRouter();
  const offline = useOffline();
  const day = { classId, date, label, baseVersion: version };
  const key = draftKey(classId, date);
  const draft = useDrafts(teacherId)[key];
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<"saved" | "failed" | null>(null);

  // What the server has, with the phone's copy over it (OFFLINE-2).
  const fromServer = Object.fromEntries(rows.map((r) => [r.studentId, r.status ?? "present"])) as Marks;
  const mark = (studentId: string) => draft?.marks[studentId] ?? fromServer[studentId];
  const onPhone = draft && (draft.state === "unsaved" || draft.state === "pending");

  function submit(options: { force?: boolean } = {}) {
    setResult(null);
    startTransition(async () => {
      const marks = Object.fromEntries(rows.map((r) => [r.studentId, mark(r.studentId)])) as Marks;
      const answer = options.force ? await send(teacherId, key, options) : await queueAndSend(teacherId, day, marks);
      if (answer.ok) {
        setResult("saved");
        router.refresh();
      } else if (answer.error !== "conflict" && answer.error !== "network") setResult("failed");
    });
  }

  function useServerCopy() {
    forget(teacherId, key);
    router.refresh();
  }

  return (
    <form
      action={() => submit()}
      className="grid gap-4"
    >
      {/* OFFLINE-3: the day was saved from somewhere else after these marks were taken. */}
      {draft?.state === "conflict" && draft.current && (
        <div role="alert" className="grid gap-3 rounded-2xl bg-alert-soft p-4 text-sm ring-1 ring-destructive/30">
          <p>
            <span className="font-bold">{tOff("conflictTitle")}</span>{" "}
            {draft.current.held
              ? tOff("conflictBody", { count: differences(draft.marks, draft.current.marks) })
              : tOff("conflictNotHeld")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => submit({ force: true })}>
              {tOff("keepPhone")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={useServerCopy}>
              {tOff("keepSaved")}
            </Button>
          </div>
        </div>
      )}
      {onPhone && !pending && (
        <p role="status" className="rounded-xl bg-highlight-soft px-4 py-3 text-sm">
          {draft.state === "pending" ? tOff("dayPending") : tOff("dayUnsaved")}
        </p>
      )}
      <ul className="divide-y rounded-2xl bg-card ring-1 ring-border">
        {rows.map((row) => (
          <li key={row.studentId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
            <span className="font-semibold">{row.name}</span>
            <fieldset className="flex gap-1.5">
              <legend className="sr-only">{row.name}</legend>
              {ATTENDANCE_STATUSES.map((status) => (
                <label key={status} title={t(`statuses.${status}`)} className="cursor-pointer">
                  <input
                    type="radio"
                    name={`mark.${row.studentId}`}
                    value={status}
                    checked={mark(row.studentId) === status}
                    onChange={() => {
                      setResult(null);
                      keepMark(teacherId, day, row.studentId, status);
                    }}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex size-10 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 ${CHECKED[status]}`}
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
      {/* The save bar stays in view while scrolling a long list; on a phone it sits above the menu bar (NAV-1). */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-card/95 p-3 shadow-lg ring-1 ring-border backdrop-blur md:bottom-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (offline ? tOff("waiting") : t("day.saving")) : t("day.save")}
        </Button>
        <p role="status" className="min-w-0 flex-1 basis-48 text-sm">
          {pending && offline && <span>{tOff("savedOnPhone")}</span>}
          {!pending && result === "saved" && <span className="text-muted-foreground">{t("day.saved")}</span>}
          {!pending && result === "failed" && <span className="text-destructive">{t("day.failed")}</span>}
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
    <form action={formAction} className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="date" value={date} />
      <h2 className="flex items-center gap-3 text-lg font-bold">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-alert-soft text-destructive">
          <CalendarX className="size-4.5" aria-hidden />
        </span>
        {t("day.noClass.title")}
      </h2>
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
      <p className="rounded-xl bg-alert-soft px-3 py-2 text-xs font-medium text-destructive">{t("day.noClass.warning")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending} className="w-full">
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
