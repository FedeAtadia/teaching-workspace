import {
  Accessibility,
  BadgeCheck,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ListChecks,
  Paperclip,
  TextAlignStart,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";
import { BackLink } from "@/components/BackLink";
import { getLocale, getTranslations } from "next-intl/server";
import { GroupFilter } from "@/components/classes/GroupFilter";
import { ScoresForm } from "@/components/classes/ScoresForm";
import { Attachment } from "@/components/classes/Attachment";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { FormDialog } from "@/components/forms/FormDialog";
import { Badge } from "@/components/ui/badge";
import { listClassStudents, listStandards, listTerms, listUnits } from "@/db/queries/classDetail";
import { getAdaptations } from "@/db/queries/adaptations";
import { getStudentGroups, listGroups } from "@/db/queries/groups";
import { getTask, listTaskScores } from "@/db/queries/tasks";
import { progress } from "@/lib/courses";
import { formatDate, formatGrade } from "@/lib/format";
import { DEFAULT_RULES, isPassing } from "@/lib/grading";
import { isAssessed } from "@/lib/groups";
import { deleteTaskAction, editTask } from "../../actions";
import { loadClass } from "../../data";
import { taskFields } from "../fields";

export default async function TaskPage({ params, searchParams }: PageProps<"/classes/[id]/tasks/[taskId]">) {
  const { id, taskId } = await params;
  const { group } = await searchParams;
  const { db, teacherId, cls } = await loadClass(id);
  const [task, roster, saved, terms, units, standards, groups, studentGroups, adaptations] = await Promise.all([
    getTask(db, teacherId, cls, taskId),
    listClassStudents(db, teacherId, cls),
    listTaskScores(db, teacherId, taskId),
    listTerms(db, teacherId, cls),
    listUnits(db, teacherId, id),
    listStandards(db, teacherId, id),
    listGroups(db, teacherId, id),
    getStudentGroups(db, teacherId, id),
    getAdaptations(db, teacherId, id),
  ]);
  if (!task) notFound();
  // ADAPT-3, ADAPT-4: whether the task has an adapted version, which adapted students' scores start marked with.
  const hasAdaptedVersion = !!(task.adaptedDescription || task.adaptedCriteria || task.adaptedAttachmentName);
  const showAdapted = adaptations.size > 0 || hasAdaptedVersion;

  // GROUP-4: only the students assessed on this task; GROUP-6: maybe one group of them.
  const taskGroupIds = task.groups.map((g) => g.groupId);
  const filterGroups = groups.filter((g) => isAssessed(taskGroupIds, g.id));
  const groupId = typeof group === "string" && filterGroups.some((g) => g.id === group) ? group : undefined;
  const assessed = roster
    .filter((s) => isAssessed(taskGroupIds, studentGroups.get(s.id)))
    .filter((s) => !groupId || studentGroups.get(s.id) === groupId);
  const tGroups = await getTranslations("groups");

  const t = await getTranslations("classPage.tasks");
  const tDelete = await getTranslations("classPage.deleteTask");
  const tErr = await getTranslations("classPage.errors");
  const scored = saved.filter((s) => s.value !== null || s.status !== "graded").length;
  const tTerm = await getTranslations("terms");
  const tScoring = await getTranslations("classPage.scoring");
  const locale = await getLocale();
  const rules = { ...DEFAULT_RULES, passMark: cls.passMark ?? DEFAULT_RULES.passMark };
  const byStudent = new Map(saved.map((s) => [s.studentId, s]));

  // The sheet's progress, for the students it shows.
  const scoredShown = assessed.filter((s) => {
    const r = byStudent.get(s.id);
    return r && (r.value !== null || r.status !== "graded");
  }).length;
  const pct = progress(scoredShown, 1, assessed.length);

  return (
    <>
      <BackLink href={`/classes/${id}/tasks`} label={t("back")} />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">{task.title}</h2>
          {task.groups.map((g) => (
            <Badge key={g.groupId} tone="accent">
              {g.name}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FormDialog
            wide
            trigger="edit"
            triggerLabel={t("edit")}
            title={t("editTitle")}
            action={editTask}
            hidden={{ classId: id, taskId: task.id }}
            formErrors={{ notFound: tErr("notFound") }}
            fields={await taskFields({ terms, units, standards, groups, adapted: showAdapted }, task)}
          />
          <ConfirmDeleteButton
            label={tDelete("button")}
            title={tDelete("title", { title: task.title })}
            body={[tDelete("body", { scored }), task.attachmentPath !== null && tDelete("withFile")]
              .filter(Boolean)
              .join(" ")}
            action={deleteTaskAction.bind(null, { classId: id, taskId: task.id })}
          />
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden />
          {tTerm(String(task.termPosition))}
        </span>
        {task.unitTitle && (
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-4" aria-hidden />
            {task.unitTitle}
          </span>
        )}
        {/* GROUP-3: with groups, each group's own date is in its card below. */}
        {task.groups.length === 0 && task.dueOn && (
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-4" aria-hidden />
            {formatDate(task.dueOn)}
          </span>
        )}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {task.description && (
          <InfoCard icon={TextAlignStart} title={t("fields.description")}>
            <p className="text-muted-foreground">{task.description}</p>
          </InfoCard>
        )}
        {task.criteria && (
          <InfoCard icon={BadgeCheck} title={t("fields.criteria")}>
            <p className="whitespace-pre-line text-muted-foreground">{task.criteria}</p>
          </InfoCard>
        )}
        {task.standards.length > 0 && (
          <InfoCard icon={ListChecks} title={t("fields.standards")}>
            <ul className="flex flex-wrap gap-1.5">
              {task.standards.map((s) => (
                <li key={s.id}>
                  <Badge tone="accent" className="whitespace-normal">
                    {s.title}
                  </Badge>
                </li>
              ))}
            </ul>
          </InfoCard>
        )}
        {task.groups.length > 0 && (
          <InfoCard icon={UsersRound} title={t("fields.groups")}>
            <ul className="flex flex-wrap gap-1.5">
              {task.groups.map((g) => (
                <li key={g.groupId}>
                  <Badge>{g.dueOn ? `${g.name} · ${formatDate(g.dueOn)}` : g.name}</Badge>
                </li>
              ))}
            </ul>
          </InfoCard>
        )}
        {showAdapted && (
          // ADAPT-3: the adapted version, for students with an adaptation.
          <InfoCard icon={Accessibility} alert title={t("adapted.title")}>
            {!task.adaptedDescription && !task.adaptedCriteria && (
              <p className="mb-2 text-muted-foreground">{t("adapted.empty")}</p>
            )}
            {(task.adaptedDescription || task.adaptedCriteria) && (
              <dl className="mb-3 grid gap-2 rounded-xl bg-alert-soft p-3">
                {task.adaptedDescription && (
                  <div>
                    <dt className="font-medium">{t("fields.description")}</dt>
                    <dd className="text-muted-foreground">{task.adaptedDescription}</dd>
                  </div>
                )}
                {task.adaptedCriteria && (
                  <div>
                    <dt className="font-medium">{t("fields.criteria")}</dt>
                    <dd className="whitespace-pre-line text-muted-foreground">{task.adaptedCriteria}</dd>
                  </div>
                )}
              </dl>
            )}
            <Attachment
              compact
              classId={id}
              target={{ kind: "adaptedTask", id: task.id }}
              teacherId={teacherId}
              current={task.adaptedAttachmentName ? { name: task.adaptedAttachmentName } : null}
            />
          </InfoCard>
        )}
        <InfoCard icon={Paperclip} title={t("fileTitle")}>
          <Attachment
            compact
            classId={id}
            target={{ kind: "task", id: task.id }}
            teacherId={teacherId}
            current={task.attachmentName ? { name: task.attachmentName } : null}
          />
        </InfoCard>
      </div>

      <section className="mt-6 rounded-2xl bg-card ring-1 ring-border">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 p-5">
          <div className="grid min-w-56 flex-1 gap-2 sm:max-w-md">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="font-heading text-lg font-bold">{tScoring("title")}</h3>
              <span className="text-sm font-semibold text-highlight tabular-nums">
                {t("scored", { scored: scoredShown, total: assessed.length })} ({pct}%)
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="[&>nav]:mb-0">
            <GroupFilter
              groups={filterGroups}
              current={groupId}
              allLabel={tGroups("all")}
              href={(g) => `/classes/${id}/tasks/${task.id}${g ? `?group=${g}` : ""}`}
            />
          </div>
        </div>
        {assessed.length === 0 ? (
          <p className="border-t p-5 text-sm text-muted-foreground">{t("noStudents")}</p>
        ) : (
          <ScoresForm
            // A fresh form per group, so switching never carries typing over.
            key={groupId ?? "all"}
            classId={id}
            taskId={task.id}
            rows={assessed.map((student) => {
              const s = byStudent.get(student.id);
              return {
                studentId: student.id,
                name: `${student.lastName}, ${student.firstName}`,
                firstName: student.firstName,
                lastName: student.lastName,
                score: s?.value != null ? formatGrade(s.value, locale) : "",
                status: s?.status ?? "graded",
                notes: s?.notes ?? "",
                passing: s?.value != null ? isPassing(s.value, rules) : null,
                adaptation: adaptations.get(student.id) ?? null,
                // ADAPT-4: as saved; with nothing saved yet, marked when the task has an adapted version.
                adapted: s ? (s.adapted ?? false) : adaptations.has(student.id) && hasAdaptedVersion,
              };
            })}
          />
        )}
      </section>
    </>
  );
}

/** One of the task's facts, as a small card with an icon and a title. */
function InfoCard({
  icon: Icon,
  title,
  alert = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  alert?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card p-5 text-sm ring-1 ring-border">
      <h3 className="mb-3 flex items-center gap-2 font-heading text-base font-bold">
        <Icon className={cn("size-5 shrink-0", alert ? "text-destructive" : "text-highlight")} aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}
