import { getTranslations } from "next-intl/server";
import { FormDialog } from "@/components/forms/FormDialog";
import { listStandards } from "@/db/queries/classDetail";
import { addStandard } from "../actions";
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
            <li key={s.id} className="rounded-lg border p-3">
              <p className="font-medium">
                <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                {s.title}
              </p>
              {s.description && (
                <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{s.description}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
