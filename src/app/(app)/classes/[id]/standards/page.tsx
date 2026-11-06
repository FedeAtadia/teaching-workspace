import { BadgeCheck, ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "cn";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Initials } from "@/components/Initials";
import { Attachment } from "@/components/classes/Attachment";
import { FormDialog, type FieldSpec } from "@/components/forms/FormDialog";
import { Badge } from "@/components/ui/badge";
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

  // ADAPT-2: a student's own standards carry the alert colour of their adaptation.
  const standardList = (items: StandardRow[], own = false) => (
    <ol className="grid gap-3">
      {items.map((s) => (
        <li key={s.id} className="flex items-start gap-3 rounded-2xl bg-card p-5 ring-1 ring-border">
          <span
            aria-hidden
            className={cn("mt-1 h-5 w-1 shrink-0 rounded-full", own ? "bg-destructive" : "bg-primary")}
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-lg leading-snug font-bold">{s.title}</h3>
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
  const adaptedStudents = roster.filter((s) => adaptations.has(s.id));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-muted-foreground">
          <BadgeCheck className="size-5 shrink-0 text-highlight" aria-hidden />
          {t("intro")}
        </p>
        <FormDialog
          triggerLabel={t("add")}
          title={t("dialogTitle")}
          action={addStandard}
          hidden={{ classId: id }}
          formErrors={formErrors}
          fields={fields()}
        />
      </div>
      {list.length === 0 ? (
        <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-border">
          {t("empty")}
        </p>
      ) : (
        standardList(list)
      )}

      {adaptedStudents.map((student) => {
        const name = `${student.lastName}, ${student.firstName}`;
        const own = ownLists.find((g) => g.studentId === student.id)?.standards ?? [];
        return (
          <section key={student.id} className="mt-8 grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-5 py-4 ring-1 ring-border">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <Initials
                  firstName={student.firstName}
                  lastName={student.lastName}
                  className="size-10 bg-alert-soft text-sm text-destructive"
                />
                <h2 className="font-heading text-lg font-bold">{t("ownTitle", { name })}</h2>
                <Badge tone="alert">{t("ownBadge")}</Badge>
              </div>
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
              <p className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-border">
                <span className="flex size-11 items-center justify-center rounded-full bg-muted">
                  <ClipboardList className="size-5" aria-hidden />
                </span>
                {t("ownEmpty")}
              </p>
            ) : (
              standardList(own, true)
            )}
          </section>
        );
      })}
    </>
  );
}
