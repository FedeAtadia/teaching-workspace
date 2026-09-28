import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FormDialog } from "@/components/forms/FormDialog";
import { listClassStudents, listStandards, listTerms, listUnits } from "@/db/queries/classDetail";
import { listTasks, type TaskRow } from "@/db/queries/tasks";
import { formatDate } from "@/lib/format";
import { addTask } from "../actions";
import { loadClass } from "../data";

export default async function TasksPage({ params }: PageProps<"/classes/[id]/tasks">) {
  const { id } = await params;
  const { db, teacherId, cls } = await loadClass(id);
  const t = await getTranslations("classPage.tasks");
  const tTerm = await getTranslations("terms");
  const tErr = await getTranslations("classPage.errors");
  const locale = await getLocale();

  const [tasks, terms, units, standards, roster] = await Promise.all([
    listTasks(db, teacherId, cls),
    listTerms(db, teacherId, cls),
    listUnits(db, teacherId, id),
    listStandards(db, teacherId, id),
    listClassStudents(db, teacherId, cls),
  ]);

  const byTerm = new Map<number, TaskRow[]>();
  for (const task of tasks) byTerm.set(task.termPosition, [...(byTerm.get(task.termPosition) ?? []), task]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        <FormDialog
          wide
          triggerLabel={t("add")}
          title={t("dialogTitle")}
          action={addTask}
          hidden={{ classId: id }}
          formErrors={{ notFound: tErr("notFound") }}
          fields={[
            { kind: "text", name: "title", label: t("fields.title"), maxLength: 120 },
            {
              kind: "select",
              name: "termId",
              label: t("fields.term"),
              options: terms.map((term) => ({ value: term.id, label: tTerm(String(term.position)) })),
              defaultValue: terms[0]?.id,
            },
            {
              kind: "select",
              name: "unitId",
              label: t("fields.unit"),
              options: [{ value: "", label: t("fields.noUnit") }, ...units.map((u) => ({ value: u.id, label: u.title }))],
            },
            { kind: "date", name: "dueOn", label: t("fields.date") },
            { kind: "textarea", name: "description", label: t("fields.description"), maxLength: 280, rows: 2 },
            { kind: "textarea", name: "criteria", label: t("fields.criteria"), maxLength: 1000, rows: 3 },
            ...(standards.length > 0
              ? [
                  {
                    kind: "checkboxes" as const,
                    name: "standardIds",
                    label: t("fields.standards"),
                    options: standards.map((s) => ({ value: s.id, label: s.title })),
                  },
                ]
              : []),
          ]}
        />
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-6">
          {[...byTerm.entries()].map(([position, list]) => (
            <section key={position}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{tTerm(String(position))}</h2>
              <ul className="grid gap-2">
                {list.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/classes/${id}/tasks/${task.id}`}
                      className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="font-medium">{task.title}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {t("scored", { scored: task.scored, total: roster.length })}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[task.dueOn && formatDate(task.dueOn, locale), task.unitTitle].filter(Boolean).join(" · ")}
                      </p>
                      {task.description && <p className="mt-1 text-sm">{task.description}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
