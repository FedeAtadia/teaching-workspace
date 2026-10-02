"use client";

import { Pencil, Plus } from "lucide-react";
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
  | { kind: "text"; name: string; label: string; maxLength: number; placeholder?: string; defaultValue?: string }
  | { kind: "textarea"; name: string; label: string; maxLength: number; rows?: number; defaultValue?: string }
  | {
      kind: "select";
      name: string;
      label: string;
      options: { value: string; label: string }[];
      defaultValue?: string;
    }
  | { kind: "date"; name: string; label: string; defaultValue?: string }
  /** Sends one `name` entry per ticked box; the action reads them with getAll. */
  | {
      kind: "checkboxes";
      name: string;
      label: string;
      options: { value: string; label: string }[];
      /** The values ticked when the form opens. */
      defaultValue?: string[];
    };

/**
 * A button that opens a small form in a dialog, sends it to a Server Action,
 * shows per-field errors, and closes once saved. Used for the add and edit
 * forms of standards, units and tasks; an edit form passes each field's
 * current value as its `defaultValue`.
 */
export function FormDialog({
  triggerLabel,
  title,
  action,
  fields,
  hidden = {},
  formErrors = {},
  wide = false,
  trigger = "add",
}: {
  /** The button's text; for "editIcon" its accessible name and tooltip. */
  triggerLabel: string;
  /**
   * "add": the main button. "addSmall": a small outlined one with a plus, for
   * inside a row. "edit": an outlined button with a pencil. "editIcon": just the pencil.
   */
  trigger?: "add" | "addSmall" | "edit" | "editIcon";
  title: string;
  /** A wider dialog, for forms with many fields. */
  wide?: boolean;
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
      {trigger === "add" && <DialogTrigger render={<Button />}>{triggerLabel}</DialogTrigger>}
      {trigger === "addSmall" && (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <Plus aria-hidden />
          {triggerLabel}
        </DialogTrigger>
      )}
      {trigger === "edit" && (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <Pencil aria-hidden />
          {triggerLabel}
        </DialogTrigger>
      )}
      {trigger === "editIcon" && (
        <DialogTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={triggerLabel} title={triggerLabel} />}
        >
          <Pencil aria-hidden />
        </DialogTrigger>
      )}
      <DialogContent
        showCloseButton={false}
        className={wide ? "max-h-[90vh] overflow-y-auto sm:max-w-lg" : "max-h-[90vh] overflow-y-auto"}
      >
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
                defaultValue={v[f.name] ?? f.defaultValue}
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
                defaultValue={v[f.name] ?? f.defaultValue}
                maxLength={f.maxLength}
                rows={f.rows ?? 3}
                aria-invalid={invalid}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
              />
            )}
            {f.kind === "date" && (
              <Input
                id={id}
                name={f.name}
                type="date"
                defaultValue={v[f.name] ?? f.defaultValue}
                aria-invalid={invalid}
                className="w-44"
              />
            )}
            {f.kind === "checkboxes" && (
              <div id={id} className="grid gap-1.5">
                {f.options.map((o) => (
                  <label key={o.value} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={f.name}
                      value={o.value}
                      // Refilled after an error: the action sends the ticked ids joined by commas.
                      defaultChecked={
                        v[f.name] !== undefined
                          ? v[f.name].split(",").includes(o.value)
                          : (f.defaultValue ?? []).includes(o.value)
                      }
                      className="mt-0.5 size-4 accent-primary"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
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
