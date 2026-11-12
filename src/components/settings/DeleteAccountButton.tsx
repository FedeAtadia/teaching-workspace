"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/app/(app)/settings/actions";
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
import { Label } from "@/components/ui/label";

/** DATA-3: deletes the account, once the teacher has typed the word that confirms it. */
export function DeleteAccountButton() {
  const t = useTranslations("settings.data");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const word = t("confirmWord");
  const confirmed = typed.trim().toLocaleUpperCase() === word;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setTyped("");
        setError(false);
      }}
    >
      <DialogTrigger render={<Button variant="destructive" size="sm" className="justify-self-start" />}>
        <Trash2 aria-hidden />
        {t("deleteButton")}
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("deleteDialogTitle")}</DialogTitle>
          <DialogDescription>{t("deleteDialogBody")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="delete-account-word">{t("confirmLabel", { word })}</Label>
          <Input
            id="delete-account-word"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t("deleteFailed")}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{tCommon("cancel")}</DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmed || pending}
            onClick={() =>
              startTransition(async () => {
                // On success the action redirects to the home page and never answers.
                const result = await deleteAccountAction();
                if (!result.ok) setError(true);
              })
            }
          >
            {pending ? tCommon("deleting") : t("deleteConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
