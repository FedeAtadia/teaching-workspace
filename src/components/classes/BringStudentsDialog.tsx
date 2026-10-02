"use client";

import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { bringStudentsAction, type BringState } from "@/app/(app)/classes/[id]/actions";
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

export type BringGroup = {
  courseId: string;
  /** Their old course, written out: "3° A · Mañana · 2025". */
  label: string;
  /** Why they come: "Promocionaron" or "Repiten". */
  reason: string;
  students: { id: string; name: string }[];
};

/** NEXT-1, NEXT-2: last year's students who move into this course, all ticked. */
export function BringStudentsDialog({
  classId,
  previousYear,
  groups,
}: {
  classId: string;
  previousYear: string;
  groups: BringGroup[];
}) {
  const t = useTranslations("nextYear");
  const [open, setOpen] = useState(false);
  const total = groups.reduce((n, g) => n + g.students.length, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlus aria-hidden />
        {t("button", { count: total })}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title", { year: previousYear })}</DialogTitle>
          <DialogDescription>{t("intro")}</DialogDescription>
        </DialogHeader>
        <BringForm classId={classId} groups={groups} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BringForm({ classId, groups, onSaved }: { classId: string; groups: BringGroup[]; onSaved: () => void }) {
  const t = useTranslations("nextYear");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<BringState, FormData>(
    async (prev, formData) => {
      const result = await bringStudentsAction(prev, formData);
      if (result.status === "saved") onSaved();
      return result;
    },
    { status: "idle" },
  );

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="classId" value={classId} />
      {groups.map((g) => (
        <fieldset key={g.courseId} className="grid gap-1.5">
          <legend className="mb-1.5 text-sm">
            <span className="font-bold">{g.label}</span> <span className="text-muted-foreground">· {g.reason}</span>
          </legend>
          {g.students.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="studentIds" value={s.id} defaultChecked className="size-4 accent-primary" />
              {s.name}
            </label>
          ))}
        </fieldset>
      ))}
      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {t("notFound")}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{tCommon("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
