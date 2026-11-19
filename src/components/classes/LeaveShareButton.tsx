"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { leaveSharedClassAction } from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";

/** SHARE-4: the guest stops seeing a class shared with them, and goes back to the rest. */
export function LeaveShareButton({ classId }: { classId: string }) {
  const t = useTranslations("shares");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await leaveSharedClassAction({ classId });
          if (result.ok) router.push("/classes");
        })
      }
    >
      <LogOut aria-hidden />
      {t("leave")}
    </Button>
  );
}
