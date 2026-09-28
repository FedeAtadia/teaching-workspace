"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { addStudent, type AddStudentState } from "@/app/(app)/students/actions";
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

export type CourseOption = { id: string; label: string };

export function AddStudentDialog({ courses }: { courses: CourseOption[] }) {
  const t = useTranslations("students");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{t("add")}</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
        </DialogHeader>
        <AddStudentForm courses={courses} />
      </DialogContent>
    </Dialog>
  );
}

type State = AddStudentState & { version: number };

// Stays open after saving: a whole course is usually typed in one sitting.
function AddStudentForm({ courses }: { courses: CourseOption[] }) {
  const t = useTranslations("students");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => ({ ...(await addStudent(prev, formData)), version: prev.version + 1 }),
    { status: "idle", version: 0 },
  );
  const v = state.values ?? {};
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? tErr(key) : undefined;
  };
  const defaultCourse = v.courseId ?? (courses.length === 1 ? courses[0].id : "");

  return (
    <form key={state.version} action={formAction} className="grid gap-4">
      {state.status === "saved" && state.added && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          {t("added", { name: `${state.added.lastName}, ${state.added.firstName}` })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field id="student-last-name" label={t("fields.lastName")} error={err("lastName")}>
          <Input
            id="student-last-name"
            name="lastName"
            defaultValue={v.lastName}
            maxLength={80}
            aria-invalid={!!err("lastName")}
            autoFocus
          />
        </Field>
        <Field id="student-first-name" label={t("fields.firstName")} error={err("firstName")}>
          <Input
            id="student-first-name"
            name="firstName"
            defaultValue={v.firstName}
            maxLength={80}
            aria-invalid={!!err("firstName")}
          />
        </Field>
      </div>

      <Field id="student-course" label={t("fields.course")} error={err("courseId")}>
        <NativeSelect
          id="student-course"
          name="courseId"
          defaultValue={defaultCourse}
          aria-invalid={!!err("courseId")}
          className="w-full"
        >
          <NativeSelectOption value="" disabled>
            {t("fields.chooseCourse")}
          </NativeSelectOption>
          {courses.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${state.formError}`)}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          {state.status === "saved" ? tCommon("done") : tCommon("cancel")}
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
