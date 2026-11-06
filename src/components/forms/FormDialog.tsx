"use client";

import { CircleAlert, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { cn } from "cn";
import { DateField } from "@/components/forms/DateField";
import { Field } from "@/components/forms/Field";
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
      /** Side by side, for short labels like the days of the week (CAL-4). */
      inline?: boolean;
      hint?: string;
    }
  /**
   * GROUP-3: one box per group, each with its own date. Sends `<name>` per
   * ticked group and `groupDue.<id>` for its date; none ticked means everyone.
   */
  | {
      kind: "groupDates";
      name: string;
      label: string;
      hint: string;
      options: { value: string; label: string }[];
      defaultValue?: { groupId: string; dueOn: string | null }[];
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
  description,
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
   * "badge": a small pill showing the label. "text": a small plain-text button.
   */
  trigger?: "add" | "addSmall" | "edit" | "editIcon" | "badge" | "text";
  title: string;
  /** A short line under the title. */
  description?: string;
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
      {trigger === "badge" && (
        <DialogTrigger className="rounded-full bg-highlight-soft px-2.5 py-0.5 text-xs font-bold text-highlight ring-primary hover:ring-1">
          {triggerLabel}
        </DialogTrigger>
      )}
      {trigger === "text" && (
        <DialogTrigger render={<Button variant="ghost" size="xs" className="text-muted-foreground" />}>
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
        className={cn("max-h-[90vh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-md", wide && "sm:max-w-xl")}
      >
        <DialogHeader className="gap-1 border-b bg-muted/50 px-5 py-4">
          <DialogTitle className="text-lg leading-snug font-bold">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
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

// The dialog's fields sit on a light tint, a little taller than elsewhere.
const TINTED = "h-10 bg-muted/50";
const TINTED_DATE = "w-48 rounded-lg bg-muted/50 [&_button]:h-10 [&_input]:h-10";
const TINTED_SELECT = "w-full rounded-lg bg-muted/50 [&_select]:h-10 [&_select]:pl-3";

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
    <form key={state.version} action={formAction} className="grid gap-5 px-5 pt-5">
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
                className={TINTED}
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
                className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:bg-alert-soft dark:bg-input/30"
              />
            )}
            {f.kind === "date" && (
              <DateField
                id={id}
                name={f.name}
                defaultValue={v[f.name] ?? f.defaultValue}
                invalid={invalid}
                className={TINTED_DATE}
              />
            )}
            {f.kind === "checkboxes" && f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            {f.kind === "checkboxes" && (
              <div
                id={id}
                className={f.inline ? "grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2" : "grid gap-1.5"}
              >
                {f.options.map((o) => (
                  <label
                    key={o.value}
                    className={
                      f.inline
                        ? // A box per day, tinted blue once ticked (CAL-4).
                          "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl bg-muted/60 px-2 py-2.5 text-sm font-medium has-checked:bg-highlight-soft has-checked:text-highlight has-focus-visible:ring-2 has-focus-visible:ring-ring"
                        : "flex items-start gap-2 text-sm"
                    }
                  >
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
                      className={f.inline ? "size-4 accent-primary" : "mt-0.5 size-4 accent-primary"}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            )}
            {f.kind === "groupDates" && (
              <div id={id} className="grid gap-2">
                <p className="text-xs text-muted-foreground">{f.hint}</p>
                {f.options.map((o) => {
                  const saved = f.defaultValue?.find((g) => g.groupId === o.value);
                  // Refilled after an error: the action sends the ticked ids joined by commas.
                  const ticked = v[f.name] !== undefined ? v[f.name].split(",").includes(o.value) : !!saved;
                  return (
                    <div key={o.value} className="flex flex-wrap items-center gap-3">
                      <label className="flex min-w-32 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name={f.name}
                          value={o.value}
                          defaultChecked={ticked}
                          className="size-4 accent-primary"
                        />
                        {o.label}
                      </label>
                      <DateField
                        name={`groupDue.${o.value}`}
                        defaultValue={v[`groupDue.${o.value}`] ?? saved?.dueOn ?? ""}
                        label={o.label}
                        className={TINTED_DATE}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {f.kind === "select" && (
              <NativeSelect
                id={id}
                name={f.name}
                defaultValue={v[f.name] ?? f.defaultValue ?? ""}
                aria-invalid={invalid}
                className={TINTED_SELECT}
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
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-alert-soft px-3 py-2.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {formErrors[state.formError] ?? tErr("invalid")}
        </p>
      )}

      <DialogFooter className="-mx-5 mt-1 mb-0 rounded-b-2xl px-5">
        <DialogClose render={<Button type="button" variant="outline" />}>{tCommon("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
