"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteTaskAction } from "@/app/(app)/classes/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** TASK-5: asks first, saying what goes with the task. */
export function DeleteTaskButton({
  classId,
  taskId,
  title,
  scored,
  hasFile,
}: {
  classId: string;
  taskId: string;
  title: string;
  /** Scores and marks saved on the task. */
  scored: number;
  hasFile: boolean;
}) {
  const t = useTranslations("classPage.deleteTask");
  const tCommon = useTranslations("common");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Trash2 aria-hidden />
        {t("button")}
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("title", { title })}</DialogTitle>
          <DialogDescription>
            {t("body", { scored })} {hasFile && t("withFile")} {t("cannotUndo")}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t("failed")}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{tCommon("cancel")}</DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                // On success the action sends us back to Tasks; it only returns on failure.
                const result = await deleteTaskAction({ classId, taskId });
                if (!result.ok) setError(true);
              })
            }
          >
            {pending ? t("deleting") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
