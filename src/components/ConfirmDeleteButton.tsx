"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
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

/**
 * A delete button that asks first, saying what goes with the item (TASK-5,
 * STD-4, UNIT-4). `action` is a Server Action already bound to the item; it
 * either redirects or answers whether it worked.
 */
export function ConfirmDeleteButton({
  label,
  title,
  body,
  action,
  iconOnly = false,
}: {
  /** The button's text; when `iconOnly`, its accessible name and tooltip. */
  label: string;
  title: string;
  /** What else is deleted or kept. "This can't be undone." is added after it. */
  body: string;
  action: () => Promise<{ ok: boolean }>;
  iconOnly?: boolean;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(false);
      }}
    >
      {iconOnly ? (
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              title={label}
              className="text-muted-foreground hover:text-destructive"
            />
          }
        >
          <Trash2 aria-hidden />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="destructive" size="sm" />}>
          <Trash2 aria-hidden />
          {label}
        </DialogTrigger>
      )}
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {body} {t("cannotUndo")}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t("deleteFailed")}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await action();
                if (result.ok) setOpen(false);
                else setError(true);
              })
            }
          >
            {pending ? t("deleting") : t("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
