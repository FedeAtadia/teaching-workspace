"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setStudentGroupAction } from "@/app/(app)/classes/[id]/actions";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/** GROUP-2: a student's group in the class, saved as soon as it is picked. */
export function StudentGroupSelect({
  classId,
  studentId,
  studentName,
  current,
  groups,
}: {
  classId: string;
  studentId: string;
  studentName: string;
  current: string | null;
  groups: { id: string; name: string }[];
}) {
  const t = useTranslations("groups");
  const [value, setValue] = useState(current ?? "");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        value={value}
        disabled={pending}
        aria-label={t("groupOf", { name: studentName })}
        size="sm"
        onChange={(e) => {
          const next = e.target.value;
          const before = value;
          setValue(next);
          setFailed(false);
          startTransition(async () => {
            const result = await setStudentGroupAction({ classId, studentId, groupId: next });
            if (!result.ok) {
              setValue(before);
              setFailed(true);
            }
          });
        }}
      >
        <NativeSelectOption value="">{t("none")}</NativeSelectOption>
        {groups.map((g) => (
          <NativeSelectOption key={g.id} value={g.id}>
            {g.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          {t("failed")}
        </span>
      )}
    </div>
  );
}
