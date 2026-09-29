"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { addClass, type AddClassState } from "@/app/(app)/classes/actions";
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
import { COURSE_YEARS, SHIFTS } from "@/lib/courses";

export function AddClassDialog({
  defaultSchoolYear,
  schools,
}: {
  defaultSchoolYear: number;
  /** The teacher's schools, suggested as they type (SCHOOL-1). */
  schools: string[];
}) {
  const t = useTranslations("classes");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{t("add")}</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
        </DialogHeader>
        {/* Its own component, so closing the dialog throws away old errors. */}
        <AddClassForm defaultSchoolYear={defaultSchoolYear} schools={schools} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

type State = AddClassState & { version: number };

function AddClassForm({
  defaultSchoolYear,
  schools,
  onSaved,
}: {
  defaultSchoolYear: number;
  schools: string[];
  onSaved: () => void;
}) {
  const t = useTranslations("classes");
  const tShift = useTranslations("shifts");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      const result = await addClass(prev, formData);
      if (result.status === "saved") onSaved();
      return { ...result, version: prev.version + 1 };
    },
    { status: "idle", version: 0 },
  );
  const v = state.values ?? {};
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? tErr(key) : undefined;
  };

  return (
    // Remounted after every submit so the fields take their refilled values.
    <form key={state.version} action={formAction} className="grid gap-4">
      <Field id="class-school" label={t("fields.school")} error={err("school")}>
        <Input
          id="class-school"
          name="school"
          list="class-school-options"
          // One school so far: most classes will be there, so start with it.
          defaultValue={v.school ?? (schools.length === 1 ? schools[0] : "")}
          placeholder={t("fields.schoolPlaceholder")}
          maxLength={120}
          autoComplete="off"
          aria-invalid={!!err("school")}
          autoFocus={schools.length !== 1}
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
          autoFocus={schools.length === 1}
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
          defaultValue={v.schoolYear ?? defaultSchoolYear}
          aria-invalid={!!err("schoolYear")}
          className="w-28"
        />
      </Field>

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
