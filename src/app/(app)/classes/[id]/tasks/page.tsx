import { CalendarDays, ChevronRight, CircleCheck, Paperclip } from "lucide-react";
import Link from "next/link";
import { progress } from "@/lib/courses";
import { getTranslations } from "next-intl/server";
import { FormDialog } from "@/components/forms/FormDialog";
import { Badge } from "@/components/ui/badge";
import { listStandards, listTerms, listUnits } from "@/db/queries/classDetail";
import { getAdaptations } from "@/db/queries/adaptations";
import { listGroups } from "@/db/queries/groups";
import { listTasks, type TaskRow } from "@/db/queries/tasks";
import { formatDate } from "@/lib/format";
import { addTask } from "../actions";
import { loadClass } from "../data";
import { taskFields } from "./fields";

export default async function TasksPage({ params }: PageProps<"/classes/[id]/tasks">) {
  const { id } = await params;
  const { db, teacherId, cls } = await loadClass(id);
  const t = await getTranslations("classPage.tasks");
  const tTerm = await getTranslations("terms");
  const tErr = await getTranslations("classPage.errors");

  const [tasks, terms, units, standards, groups, adaptations] = await Promise.all([
    listTasks(db, teacherId, cls),
    listTerms(db, teacherId, cls),
    listUnits(db, teacherId, id),
    listStandards(db, teacherId, id),
    listGroups(db, teacherId, id),
    getAdaptations(db, teacherId, id),
  ]);

  const byTerm = new Map<number, TaskRow[]>();
  for (const task of tasks) byTerm.set(task.termPosition, [...(byTerm.get(task.termPosition) ?? []), task]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted-foreground">{t("intro")}</p>
        <FormDialog
          wide
          triggerLabel={t("add")}
          title={t("dialogTitle")}
          action={addTask}
          hidden={{ classId: id }}
          formErrors={{ notFound: tErr("notFound") }}
          fields={await taskFields({ terms, units, standards, groups, adapted: adaptations.size > 0 })}
        />
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-border">
          {t("empty")}
        </p>
      ) : (
        <div className="grid gap-8">
          {[...byTerm.entries()].map(([position, list]) => (
            <section key={position}>
              <div className="mb-3 flex items-center gap-3">
                <span aria-hidden className="h-6 w-1 rounded-full bg-primary" />
                <h2 className="font-heading text-xl font-bold">{tTerm(String(position))}</h2>
                <Badge>{t("count", { count: list.length })}</Badge>
              </div>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((task) => {
                  // GROUP-5: out of the students assessed on it.
                  const pct = progress(task.scored, 1, task.assessed);
                  const done = task.assessed > 0 && task.scored >= task.assessed;
                  // GROUP-3: each group's own date; the groups themselves show as badges.
                  const info =
                    task.groups.length > 0
                      ? [
                          ...task.groups.filter((g) => g.dueOn).map((g) => `${g.name} ${formatDate(g.dueOn!)}`),
                          task.unitTitle,
                        ]
                      : [task.dueOn && formatDate(task.dueOn), task.unitTitle];
                  const infoLine = info.filter(Boolean).join(" · ");
                  return (
                    <li key={task.id}>
                      <Link
                        href={`/classes/${id}/tasks/${task.id}`}
                        className="group flex h-full flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                            {task.hasFile && (
                              <Badge tone="accent">
                                <Paperclip aria-hidden />
                                {t("file")}
                              </Badge>
                            )}
                            {task.groups.map((g) => (
                              <Badge key={g.groupId}>{g.name}</Badge>
                            ))}
                          </div>
                          <span className="-mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground">
                            <ChevronRight className="size-4" aria-hidden />
                          </span>
                        </div>
                        <h3 className="font-heading text-lg leading-snug font-bold">{task.title}</h3>
                        {infoLine && (
                          <p className="-mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                            <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
                            <span>{infoLine}</span>
                          </p>
                        )}
                        {task.description && <p className="line-clamp-2 text-sm">{task.description}</p>}
                        <div className="mt-auto grid gap-1.5 pt-2">
                          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground tabular-nums">
                            <span>{t("scored", { scored: task.scored, total: task.assessed })}</span>
                            <span className="flex items-center gap-1 font-bold text-highlight">
                              {done && <CircleCheck className="size-3.5" aria-hidden />}
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
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
