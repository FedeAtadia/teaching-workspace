import { getTranslations } from "next-intl/server";
import { FormDialog } from "@/components/forms/FormDialog";
import { listTerms, listUnits } from "@/db/queries/classDetail";
import { addUnit } from "../actions";
import { loadClass } from "../data";

export default async function UnitsPage({ params }: PageProps<"/classes/[id]/units">) {
  const { id } = await params;
  const { db, teacherId, cls } = await loadClass(id);
  const t = await getTranslations("classPage.units");
  const tTerm = await getTranslations("terms");
  const tErr = await getTranslations("classPage.errors");
  const [list, terms] = await Promise.all([listUnits(db, teacherId, id), listTerms(db, teacherId, cls)]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        <FormDialog
          triggerLabel={t("add")}
          title={t("dialogTitle")}
          action={addUnit}
          hidden={{ classId: id }}
          formErrors={{ notFound: tErr("notFound") }}
          fields={[
            { kind: "text", name: "title", label: t("fields.title"), maxLength: 120 },
            {
              kind: "select",
              name: "termId",
              label: t("fields.term"),
              options: [
                { value: "", label: t("fields.noTerm") },
                ...terms.map((term) => ({ value: term.id, label: tTerm(String(term.position)) })),
              ],
            },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="grid gap-2">
          {list.map((u, i) => (
            <li key={u.id} className="flex items-baseline justify-between gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
              <span className="font-medium">
                <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                {u.title}
              </span>
              {u.termPosition !== null && (
                <span className="text-sm whitespace-nowrap text-muted-foreground">
                  {tTerm(String(u.termPosition))}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
