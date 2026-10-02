import { getTranslations } from "next-intl/server";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Attachment } from "@/components/classes/Attachment";
import { FormDialog, type FieldSpec } from "@/components/forms/FormDialog";
import { getAdaptations, listStudentStandards } from "@/db/queries/adaptations";
import { listClassStudents, listStandards, type StandardRow } from "@/db/queries/classDetail";
import { addStandard, editStandard, removeStandard } from "../actions";
import { loadClass } from "../data";

/** STD-1..4, FILE-4, ADAPT-2 */
export default async function StandardsPage({ params }: PageProps<"/classes/[id]/standards">) {
  const { id } = await params;
  const { db, teacherId, cls } = await loadClass(id);
  const t = await getTranslations("classPage.standards");
  const tErr = await getTranslations("classPage.errors");
  const [list, ownLists, roster, adaptations] = await Promise.all([
    listStandards(db, teacherId, id),
    listStudentStandards(db, teacherId, id),
    listClassStudents(db, teacherId, cls),
    getAdaptations(db, teacherId, id),
  ]);

  // The same form adds a standard or, with its current values, changes one.
  const fields = (current?: StandardRow): FieldSpec[] => [
    { kind: "text", name: "title", label: t("fields.title"), maxLength: 200, defaultValue: current?.title },
    {
      kind: "textarea",
      name: "description",
      label: t("fields.description"),
      maxLength: 1000,
      defaultValue: current?.description ?? undefined,
    },
  ];
  const formErrors = { notFound: tErr("notFound") };

  const standardList = (items: StandardRow[]) => (
    <ol className="grid gap-3">
      {items.map((s, i) => (
        <li key={s.id} className="flex items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
              {s.title}
            </p>
            {s.description && <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{s.description}</p>}
            {/* FILE-4: a rubric or any other file for this standard. */}
            <div className="mt-3">
              <Attachment
                compact
                classId={id}
                target={{ kind: "standard", id: s.id }}
                teacherId={teacherId}
                current={s.attachmentName ? { name: s.attachmentName } : null}
              />
            </div>
          </div>
          <div className="-my-1 flex shrink-0">
            <FormDialog
              trigger="editIcon"
              triggerLabel={t("edit")}
              title={t("editTitle")}
              action={editStandard}
              hidden={{ classId: id, standardId: s.id }}
              formErrors={formErrors}
              fields={fields(s)}
            />
            <ConfirmDeleteButton
              iconOnly
              label={t("delete")}
              title={t("deleteTitle", { title: s.title })}
              body={[t("deleteBody", { tasks: s.tasks }), s.attachmentName && t("deleteWithFile")]
                .filter(Boolean)
                .join(" ")}
              action={removeStandard.bind(null, { classId: id, standardId: s.id })}
            />
          </div>
        </li>
      ))}
    </ol>
  );

  // ADAPT-2: a section per student with an adaptation (even with no standards yet), in roster order.
  const nameOf = new Map(roster.map((s) => [s.id, `${s.lastName}, ${s.firstName}`]));
  const adaptedStudents = roster.filter((s) => adaptations.has(s.id));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        <FormDialog
          triggerLabel={t("add")}
          title={t("dialogTitle")}
          action={addStandard}
          hidden={{ classId: id }}
          formErrors={formErrors}
          fields={fields()}
        />
      </div>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : standardList(list)}

      {adaptedStudents.map((student) => {
        const name = nameOf.get(student.id)!;
        const own = ownLists.find((g) => g.studentId === student.id)?.standards ?? [];
        return (
          <section key={student.id} className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-extrabold">
                {t("ownTitle", { name })}
                <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 align-middle text-[0.7rem] font-bold text-chalk">
                  {t("ownBadge")}
                </span>
              </h2>
              <FormDialog
                trigger="addSmall"
                triggerLabel={t("add")}
                title={t("ownDialogTitle", { name })}
                action={addStandard}
                hidden={{ classId: id, studentId: student.id }}
                formErrors={formErrors}
                fields={fields()}
              />
            </div>
            {own.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("ownEmpty")}</p>
            ) : (
              standardList(own)
            )}
          </section>
        );
      })}
    </>
  );
}
