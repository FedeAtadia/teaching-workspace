"use client";

import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { addClass, editClass, type AddClassState } from "@/app/(app)/classes/actions";
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
import { COURSE_YEARS, SHIFTS, type Shift } from "@/lib/courses";

export function AddClassDialog({
  defaultSchoolYear,
  schools,
  appearance = "button",
}: {
  defaultSchoolYear: number;
  /** The teacher's schools, suggested as they type (SCHOOL-1). */
  schools: string[];
  /** "card": a dashed card, for the end of a grid of class cards. */
  appearance?: "button" | "card";
}) {
  const t = useTranslations("classes");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {appearance === "card" ? (
        <DialogTrigger className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-base font-bold text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
          <Plus className="size-6" aria-hidden />
          {t("add")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus aria-hidden />
          {t("add")}
        </DialogTrigger>
      )}
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
        </DialogHeader>
        {/* Its own component, so closing the dialog throws away old errors. */}
        <ClassForm
          action={addClass}
          // One school so far: most classes will be there, so start with it.
          initial={{ school: schools.length === 1 ? schools[0] : "", schoolYear: String(defaultSchoolYear) }}
          schools={schools}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export type ClassFields = {
  school: string;
  name: string;
  year: number;
  division: string;
  shift: Shift;
  schoolYear: string;
};

/** CLASS-6: the same form, filled in with the class as it is. */
export function EditClassDialog({
  classId,
  current,
  schools,
  otherClasses,
}: {
  classId: string;
  current: ClassFields;
  schools: string[];
  /** The course's other subjects, which a change to the course also changes. */
  otherClasses: string[];
}) {
  const t = useTranslations("classes");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil aria-hidden />
        {t("edit")}
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
        </DialogHeader>
        <ClassForm
          action={editClass}
          hidden={{ classId }}
          initial={{ ...current, year: String(current.year) }}
          schools={schools}
          note={otherClasses.length > 0 ? t("editNote", { classes: otherClasses.join(", ") }) : undefined}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

type State = AddClassState & { version: number };

function ClassForm({
  action,
  initial,
  hidden = {},
  schools,
  note,
  onSaved,
}: {
  action: (prev: AddClassState, formData: FormData) => Promise<AddClassState>;
  /** What the fields start with, as the form sends them. */
  initial: Partial<Record<"school" | "name" | "year" | "division" | "shift" | "schoolYear", string>>;
  hidden?: Record<string, string>;
  schools: string[];
  /** Shown under the course fields. */
  note?: string;
  onSaved: () => void;
}) {
  const t = useTranslations("classes");
  const tShift = useTranslations("shifts");
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
  const v = { ...initial, ...state.values };
  // Typing starts at the first empty field.
  const focusName = !!v.school;
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? tErr(key) : undefined;
  };

  return (
    // Remounted after every submit so the fields take their refilled values.
    <form key={state.version} action={formAction} className="grid gap-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Field id="class-school" label={t("fields.school")} error={err("school")}>
        <Input
          id="class-school"
          name="school"
          list="class-school-options"
          defaultValue={v.school}
          placeholder={t("fields.schoolPlaceholder")}
          maxLength={120}
          autoComplete="off"
          aria-invalid={!!err("school")}
          autoFocus={!focusName}
        />
        <datalist id="class-school-options">
          {schools.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <Field id="class-name" label={t("fields.name")} error={err("name")}>
        <Input
          id="class-name"
          name="name"
          defaultValue={v.name}
          placeholder={t("fields.namePlaceholder")}
          maxLength={80}
          aria-invalid={!!err("name")}
          autoFocus={focusName}
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field id="class-year" label={t("fields.year")} error={err("year")}>
          <NativeSelect
            id="class-year"
            name="year"
            defaultValue={v.year ?? ""}
            aria-invalid={!!err("year")}
            className="w-full"
          >
            <NativeSelectOption value="" disabled>
              {t("fields.chooseYear")}
            </NativeSelectOption>
            {COURSE_YEARS.map((y) => (
              <NativeSelectOption key={y} value={y}>
                {y}°
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id="class-division" label={t("fields.division")} error={err("division")}>
          <Input
            id="class-division"
            name="division"
            defaultValue={v.division}
            placeholder={t("fields.divisionPlaceholder")}
            maxLength={10}
            aria-invalid={!!err("division")}
          />
        </Field>
        <Field id="class-shift" label={t("fields.shift")} error={err("shift")}>
          <NativeSelect
            id="class-shift"
            name="shift"
            defaultValue={v.shift ?? "morning"}
            aria-invalid={!!err("shift")}
            className="w-full"
          >
            {SHIFTS.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {tShift(s)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field id="class-school-year" label={t("fields.schoolYear")} error={err("schoolYear")}>
        <Input
          id="class-school-year"
          name="schoolYear"
          type="number"
          inputMode="numeric"
          min={2000}
          max={2100}
          defaultValue={v.schoolYear}
          aria-invalid={!!err("schoolYear")}
          className="w-28"
        />
      </Field>

      {note && <p className="text-sm text-muted-foreground">{note}</p>}

      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${state.formError}`)}
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
