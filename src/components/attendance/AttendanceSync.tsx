"use client";

import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOffline } from "next/offline";
import { useTranslations } from "next-intl";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { needsAttention, pendingDrafts } from "@/lib/offlineAttendance";
import { forget, send, useDrafts } from "./drafts";

/**
 * OFFLINE-1, OFFLINE-4: in the app's frame, on every page. Says when there is
 * no signal; sends the attendance queued on the phone on opening and whenever
 * the signal returns; and lists the days that need the teacher.
 */
export function AttendanceSync({ teacherId }: { teacherId: string }) {
  const t = useTranslations("offline");
  const router = useRouter();
  const offline = useOffline();
  const drafts = useDrafts(teacherId);
  const pending = pendingDrafts(drafts);
  const attention = needsAttention(drafts);
  const [sending, startSending] = useTransition();

  function sendAll() {
    const queue = pendingDrafts(drafts);
    if (queue.length === 0) return;
    startSending(async () => {
      let saved = false;
      // One at a time, oldest first: each waits for the signal if there is none.
      for (const [key] of queue) saved = (await send(teacherId, key)).ok || saved;
      // What the pages show came from before these days were saved.
      if (saved) router.refresh();
    });
  }

  // On opening, and again each time the signal comes back.
  const waiting = pending.length;
  useEffect(() => {
    if (waiting > 0 && !offline) sendAll();
    // sendAll reads the drafts it needs itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline, waiting > 0]);

  if (!offline && pending.length === 0 && attention.length === 0) return null;

  return (
    <div className="mb-6 grid gap-2 print:hidden">
      {offline && (
        <p role="status" className="flex items-start gap-3 rounded-2xl bg-muted p-3 text-sm">
          <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("banner")}</span>
        </p>
      )}
      {pending.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-highlight-soft p-3 text-sm">
          <RefreshCw className={`size-4 shrink-0 text-highlight ${sending && !offline ? "animate-spin" : ""}`} aria-hidden />
          <span className="min-w-0 flex-1 basis-56">
            {t("pending", { count: pending.length })} {offline ? t("pendingOffline") : sending ? t("sending") : ""}
          </span>
          {!offline && !sending && (
            <Button type="button" size="sm" variant="outline" onClick={sendAll}>
              {t("sendNow")}
            </Button>
          )}
        </div>
      )}
      {attention.map(([key, draft]) => (
        <div
          key={key}
          role="alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-alert-soft p-3 text-sm ring-1 ring-destructive/30"
        >
          <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
          <span className="min-w-0 flex-1 basis-56">
            <span className="font-bold">{draft.label}:</span>{" "}
            {draft.state === "conflict" ? t("conflictShort") : t("failed")}
          </span>
          {draft.state === "conflict" ? (
            <Link
              href={`/classes/${draft.classId}/attendance/${draft.date}`}
              className="font-semibold text-highlight underline underline-offset-4"
            >
              {t("review")}
            </Link>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => forget(teacherId, key)}>
              {t("discard")}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
