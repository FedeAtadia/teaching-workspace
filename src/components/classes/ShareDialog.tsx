"use client";

import { Share2, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import {
  revokeShareAction,
  setShareAdaptationsAction,
  shareClassAction,
} from "@/app/(app)/classes/[id]/actions";
import { Field } from "@/components/forms/Field";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import type { ClassShare } from "@/db/queries/shares";
import type { FormState } from "@/lib/formState";

/**
 * SHARE-1, SHARE-3, SHARE-4: on a class's page, for its owner. Who it is
 * shared with, whether each sees adaptations, stopping a share, and adding
 * a teacher by email.
 */
export function ShareDialog({ classId, shares }: { classId: string; shares: ClassShare[] }) {
  const t = useTranslations("shares");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Share2 aria-hidden />
        {t("button")}
        {shares.length > 0 && <span className="tabular-nums opacity-70">{shares.length}</span>}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("intro")}</DialogDescription>
        </DialogHeader>

        {shares.length > 0 && (
          <ul className="grid gap-2">
            {shares.map((s) => (
              <ShareRow key={s.id} classId={classId} share={s} />
            ))}
          </ul>
        )}

        {/* Its own component, so closing the dialog throws away old errors. */}
        <AddShareForm classId={classId} />

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{tCommon("done")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareRow({ classId, share }: { classId: string; share: ClassShare }) {
  const t = useTranslations("shares");
  const [pending, startTransition] = useTransition();
  return (
    <li className="grid gap-2 rounded-xl bg-muted/60 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 truncate font-semibold">{share.guestName ?? share.guestEmail}</span>
        {share.guestName && <span className="min-w-0 truncate text-sm text-muted-foreground">{share.guestEmail}</span>}
        <Badge tone={share.status === "accepted" ? "accent" : "outline"}>{t(`status.${share.status}`)}</Badge>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={share.includeAdaptations}
            disabled={pending}
            onChange={(e) =>
              startTransition(async () => {
                await setShareAdaptationsAction({ classId, shareId: share.id, includeAdaptations: e.target.checked });
              })
            }
            className="size-4 accent-primary"
          />
          {t("adaptations")}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-muted-foreground hover:text-destructive"
          onClick={() =>
            startTransition(async () => {
              await revokeShareAction({ classId, shareId: share.id });
            })
          }
        >
          <UserMinus aria-hidden />
          {t("revoke")}
        </Button>
      </div>
    </li>
  );
}

type State = FormState<"self" | "notFound"> & { version: number };

function AddShareForm({ classId }: { classId: string }) {
  const t = useTranslations("shares");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => ({ ...(await shareClassAction(prev, formData)), version: prev.version + 1 }),
    { status: "idle", version: 0 },
  );
  const v = state.values ?? {};
  const emailError = state.fieldErrors?.email;

  return (
    // Remounted after every submit: empty once shared, refilled after an error.
    <form key={state.version} action={formAction} className="grid gap-3 rounded-xl p-3 ring-1 ring-border">
      <input type="hidden" name="classId" value={classId} />
      <Field id="share-email" label={t("email")} error={emailError ? tErr(emailError) : undefined}>
        <Input
          id="share-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder={t("emailPlaceholder")}
          defaultValue={state.status === "error" ? v.email : ""}
          aria-invalid={!!emailError}
        />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="includeAdaptations"
          defaultChecked={state.status === "error" && v.includeAdaptations === "on"}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          {t("adaptations")}
          <span className="block text-xs text-muted-foreground">{t("adaptationsHint")}</span>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">{t("readOnly")}</p>
      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${state.formError}`)}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("sent")}
        </p>
      )}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? tCommon("saving") : t("submit")}
      </Button>
    </form>
  );
}
