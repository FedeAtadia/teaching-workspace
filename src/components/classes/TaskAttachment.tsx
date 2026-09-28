"use client";

import { FileText, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { recordTaskFile, removeTaskFile } from "@/app/(app)/classes/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  ATTACHMENT_BUCKET,
  ATTACHMENT_TYPES,
  attachmentPath,
  checkAttachment,
} from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";

type Props = {
  classId: string;
  taskId: string;
  /** The signed-in teacher: the file goes in their folder (FILE-2). */
  teacherId: string;
  current: { name: string } | null;
};

/** FILE-1..3: attach, open, replace or remove the task's file. */
export function TaskAttachment({ classId, taskId, teacherId, current }: Props) {
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
    const path = attachmentPath(teacherId, taskId, file.name);
    const { error: uploadError } = await createClient()
      .storage.from(ATTACHMENT_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (uploadError) return setError(t("errors.uploadFailed"));

    startTransition(async () => {
      const result = await recordTaskFile({ classId, taskId, path, name: file.name });
      if (!result.ok) setError(t("errors.notFound"));
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeTaskFile({ classId, taskId });
      if (!result.ok) setError(t("errors.notFound"));
    });
  }

  return (
    <section className="mt-4 rounded-lg border p-3">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Paperclip className="size-4" aria-hidden />
        {t("title")}
      </h3>

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
              href={`/classes/${classId}/tasks/${taskId}/file`}
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
