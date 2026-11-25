"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { setFollowUpDismissedAction } from "@/app/(app)/students/actions";
import { Button } from "@/components/ui/button";

/** FOLLOW-6: takes the student out of follow-up in one class for the cuatrimestre, or puts them back. */
export function FollowUpToggle({
  classId,
  studentId,
  term,
  dismissed,
}: {
  classId: string;
  studentId: string;
  term: number;
  /** True: the button puts them back. */
  dismissed: boolean;
}) {
  const t = useTranslations("followUp");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="xs"
      variant={dismissed ? "outline" : "ghost"}
      disabled={pending}
      className={dismissed ? "" : "text-muted-foreground hover:text-foreground"}
      onClick={() =>
        startTransition(async () => {
          await setFollowUpDismissedAction({ classId, studentId, term, dismissed: !dismissed });
        })
      }
    >
      {dismissed ? t("restore") : t("dismiss")}
    </Button>
  );
}
