"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { acceptShareAction, declineShareAction } from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";

export type Invitation = { shareId: string; text: string };

/** SHARE-2: classes offered to this teacher, on Home, to accept or decline. */
export function ShareInvitations({ invitations }: { invitations: Invitation[] }) {
  const t = useTranslations("shares");
  const [pending, startTransition] = useTransition();
  if (invitations.length === 0) return null;
  return (
    <section className="grid gap-2">
      {invitations.map((inv) => (
        <div
          key={inv.shareId}
          role="status"
          className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-highlight-soft p-4"
        >
          <Share2 className="size-5 shrink-0 text-highlight" aria-hidden />
          <p className="min-w-0 flex-1 basis-64">{inv.text}</p>
          <span className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => startTransition(async () => void (await acceptShareAction({ shareId: inv.shareId })))}
            >
              {t("accept")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => startTransition(async () => void (await declineShareAction({ shareId: inv.shareId })))}
            >
              {t("decline")}
            </Button>
          </span>
        </div>
      ))}
    </section>
  );
}
