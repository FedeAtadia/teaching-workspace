"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { FormState } from "@/lib/formState";

export type FieldSpec =
  | { kind: "text"; name: string; label: string; maxLength: number; placeholder?: string }
  | { kind: "textarea"; name: string; label: string; maxLength: number; rows?: number }
  | {
      kind: "select";
      name: string;
      label: string;
      options: { value: string; label: string }[];
      defaultValue?: string;
    };

/**
 * A button that opens a small form in a dialog, sends it to a Server Action,
 * shows per-field errors, and closes once saved. Used for the simple "add"
 * forms (standards, units); richer forms build their own.
 */
export function FormDialog({
  triggerLabel,
  title,
  action,
  fields,
  hidden = {},
  formErrors = {},
}: {
  triggerLabel: string;
  title: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: FieldSpec[];
  /** Sent with the form but not shown, e.g. the class id. */
  hidden?: Record<string, string>;
  /** Text for each `formError` key the action can answer with. */
  formErrors?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{triggerLabel}</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* Its own component, so closing the dialog throws away old errors. */}
        <DialogForm
          action={action}
          fields={fields}
          hidden={hidden}
          formErrors={formErrors}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

type State = FormState & { version: number };

function DialogForm({
  action,
  fields,
  hidden,
  formErrors,
  onSaved,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: FieldSpec[];
  hidden: Record<string, string>;
  formErrors: Record<string, string>;
  onSaved: () => void;
}) {
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result.status === "saved") onSaved();
      return { ...result, version: prev.version + 1 };
    },
    { status: "idle", version: 0 },
  );
  const v = state.values ?? {};
  const err = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? tErr(key) : undefined;
  };

  return (
    // Remounted after every submit so the fields take their refilled values.
    <form key={state.version} action={formAction} className="grid gap-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((f, i) => {
        const id = `field-${f.name}`;
        const invalid = !!err(f.name);
        return (
          <Field key={f.name} id={id} label={f.label} error={err(f.name)}>
            {f.kind === "text" && (
              <Input
                id={id}
                name={f.name}
                defaultValue={v[f.name]}
                maxLength={f.maxLength}
                placeholder={f.placeholder}
                aria-invalid={invalid}
                autoFocus={i === 0}
              />
            )}
            {f.kind === "textarea" && (
              <textarea
                id={id}
                name={f.name}
                defaultValue={v[f.name]}
                maxLength={f.maxLength}
                rows={f.rows ?? 3}
                aria-invalid={invalid}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
              />
            )}
            {f.kind === "select" && (
              <NativeSelect
                id={id}
                name={f.name}
                defaultValue={v[f.name] ?? f.defaultValue ?? ""}
                aria-invalid={invalid}
                className="w-full"
              >
                {f.options.map((o) => (
                  <NativeSelectOption key={o.value} value={o.value}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </Field>
        );
      })}

      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {formErrors[state.formError] ?? tErr("invalid")}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{tCommon("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
