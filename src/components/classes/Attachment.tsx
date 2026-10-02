"use client";

import { FileText, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import {
  recordAdaptedTaskFile,
  recordStandardFile,
  recordTaskFile,
  removeAdaptedTaskFile,
  removeStandardFile,
  removeTaskFile,
} from "@/app/(app)/classes/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  adaptedTaskFolder,
  ATTACHMENT_BUCKET,
  ATTACHMENT_TYPES,
  attachmentPath,
  checkAttachment,
  standardFolder,
} from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";

type Props = {
  classId: string;
  /** What the file belongs to: a task (FILE-1..3), a passing standard (FILE-4) or a task's adapted version (ADAPT-3). */
  target: { kind: "task" | "standard" | "adaptedTask"; id: string };
  /** The signed-in teacher: the file goes in their folder (FILE-2). */
  teacherId: string;
  current: { name: string } | null;
  /** Inside a list item: no box or heading. */
  compact?: boolean;
};

/** FILE-1..4: attach, open, replace or remove a task's or a standard's file. */
export function Attachment({ classId, target, teacherId, current, compact = false }: Props) {
  const t = useTranslations("classPage.attachment");
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = uploading || pending;

  async function upload(file: File) {
    setError(null);
    const check = checkAttachment(file);
    if (check !== "ok") return setError(t(`errors.${check}`));

    // Straight to Storage from the browser: a Server Action would cap it at 1 MB.
    setUploading(true);
    const folder =
      target.kind === "task"
        ? target.id
        : target.kind === "adaptedTask"
          ? adaptedTaskFolder(target.id)
          : standardFolder(target.id);
    const path = attachmentPath(teacherId, folder, file.name);
    const { error: uploadError } = await createClient()
      .storage.from(ATTACHMENT_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (uploadError) return setError(t("errors.uploadFailed"));

    startTransition(async () => {
      const record = { path, name: file.name };
      const result =
        target.kind === "task"
          ? await recordTaskFile({ classId, taskId: target.id, ...record })
          : target.kind === "adaptedTask"
            ? await recordAdaptedTaskFile({ classId, taskId: target.id, ...record })
            : await recordStandardFile({ classId, standardId: target.id, ...record });
      if (!result.ok) setError(t("errors.notFound"));
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result =
        target.kind === "task"
          ? await removeTaskFile({ classId, taskId: target.id })
          : target.kind === "adaptedTask"
            ? await removeAdaptedTaskFile({ classId, taskId: target.id })
            : await removeStandardFile({ classId, standardId: target.id });
      if (!result.ok) setError(t("errors.notFound"));
    });
  }

  const href =
    target.kind === "task"
      ? `/classes/${classId}/tasks/${target.id}/file`
      : target.kind === "adaptedTask"
        ? `/classes/${classId}/tasks/${target.id}/file?adapted=1`
        : `/classes/${classId}/standards/${target.id}/file`;

  return (
    <section className={compact ? "" : "mt-4 rounded-lg border p-3"}>
      {!compact && (
        <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Paperclip className="size-4" aria-hidden />
          {t("title")}
        </h3>
      )}

      <input
        ref={input}
        type="file"
        accept={ATTACHMENT_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // choosing the same file again still triggers
          if (file) void upload(file);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {current ? (
          <>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 text-sm underline-offset-4 hover:underline"
            >
              <FileText className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{current.name}</span>
            </a>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              {t("replace")}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={remove}>
              {t("remove")}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              {t("upload")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("hint")}</span>
          </>
        )}
        {busy && <span className="text-xs text-muted-foreground">{t("working")}</span>}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
