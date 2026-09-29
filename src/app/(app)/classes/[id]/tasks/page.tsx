import { CalendarDays, Paperclip } from "lucide-react";
import Link from "next/link";
import { progress } from "@/lib/courses";
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
        <div className="grid gap-8">
          {[...byTerm.entries()].map(([position, list]) => (
            <section key={position}>
              <h2 className="mb-3 text-lg font-bold text-muted-foreground">{tTerm(String(position))}</h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {list.map((task) => {
                  const pct = progress(task.scored, 1, roster.length);
                  return (
                    <li key={task.id}>
                      <Link
                        href={`/classes/${id}/tasks/${task.id}`}
                        className="group flex h-full flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-lg leading-tight font-extrabold">{task.title}</h3>
                          {task.hasFile && (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-chalk">
                              <Paperclip className="size-3.5" aria-hidden />
                              {t("file")}
                            </span>
                          )}
                        </div>
                        {(task.dueOn || task.unitTitle) && (
                          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <CalendarDays className="size-4 shrink-0" aria-hidden />
                            {[task.dueOn && formatDate(task.dueOn, locale), task.unitTitle].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {task.description && <p className="text-sm">{task.description}</p>}
                        <div className="mt-auto flex items-center gap-3 pt-1">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                            {t("scored", { scored: task.scored, total: roster.length })}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
