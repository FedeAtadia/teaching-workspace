import { getTranslations } from "next-intl/server";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { FormDialog } from "@/components/forms/FormDialog";
import { listStandards } from "@/db/queries/classDetail";
import { addStandard, editStandard, removeStandard } from "../actions";
import { loadClass } from "../data";

export default async function StandardsPage({ params }: PageProps<"/classes/[id]/standards">) {
  const { id } = await params;
  const { db, teacherId } = await loadClass(id);
  const t = await getTranslations("classPage.standards");
  const tErr = await getTranslations("classPage.errors");
  const list = await listStandards(db, teacherId, id);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        <FormDialog
          triggerLabel={t("add")}
          title={t("dialogTitle")}
          action={addStandard}
          hidden={{ classId: id }}
          formErrors={{ notFound: tErr("notFound") }}
          fields={[
            { kind: "text", name: "title", label: t("fields.title"), maxLength: 200 },
            { kind: "textarea", name: "description", label: t("fields.description"), maxLength: 1000 },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="grid gap-3">
          {list.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                  {s.title}
                </p>
                {s.description && (
                  <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{s.description}</p>
                )}
              </div>
              <div className="-my-1 flex shrink-0">
                <FormDialog
                  trigger="editIcon"
                  triggerLabel={t("edit")}
                  title={t("editTitle")}
                  action={editStandard}
                  hidden={{ classId: id, standardId: s.id }}
                  formErrors={{ notFound: tErr("notFound") }}
                  fields={[
                    { kind: "text", name: "title", label: t("fields.title"), maxLength: 200, defaultValue: s.title },
                    {
                      kind: "textarea",
                      name: "description",
                      label: t("fields.description"),
                      maxLength: 1000,
                      defaultValue: s.description ?? undefined,
                    },
                  ]}
                />
                <ConfirmDeleteButton
                  iconOnly
                  label={t("delete")}
                  title={t("deleteTitle", { title: s.title })}
                  body={t("deleteBody", { tasks: s.tasks })}
                  action={removeStandard.bind(null, { classId: id, standardId: s.id })}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
