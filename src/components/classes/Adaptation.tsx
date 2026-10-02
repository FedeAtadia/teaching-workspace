import { getTranslations } from "next-intl/server";
import { saveAdaptation } from "@/app/(app)/classes/[id]/actions";
import { FormDialog } from "@/components/forms/FormDialog";

/**
 * ADAPT-1: the "Adaptación" badge, opening the text of what is adapted; or,
 * for a student without one, a small button to add it.
 */
export async function AdaptationButton({
  classId,
  studentId,
  studentName,
  notes,
}: {
  classId: string;
  studentId: string;
  studentName: string;
  notes: string | null;
}) {
  const t = await getTranslations("adaptations");
  return (
    <FormDialog
      trigger={notes ? "badge" : "text"}
      triggerLabel={notes ? t("badge") : t("add")}
      title={t("title", { name: studentName })}
      action={saveAdaptation}
      hidden={{ classId, studentId }}
      formErrors={{ notFound: t("notFound") }}
      fields={[
        { kind: "textarea", name: "notes", label: t("field"), maxLength: 2000, rows: 5, defaultValue: notes ?? undefined },
      ]}
    />
  );
}

/** ADAPT-1: the read-only badge, its text shown on hover. */
export async function AdaptedBadge({ notes }: { notes: string }) {
  const t = await getTranslations("adaptations");
  return (
    <span
      title={notes}
      className="relative z-10 ml-1.5 inline-block rounded-full bg-primary/15 px-2 py-0.5 align-middle text-[0.7rem] font-bold text-chalk"
    >
      {t("badge")}
    </span>
  );
}
