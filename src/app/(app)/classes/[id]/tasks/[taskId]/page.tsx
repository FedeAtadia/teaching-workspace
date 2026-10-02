import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { getLocale, getTranslations } from "next-intl/server";
import { GroupFilter } from "@/components/classes/GroupFilter";
import { ScoresForm } from "@/components/classes/ScoresForm";
import { Attachment } from "@/components/classes/Attachment";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { FormDialog } from "@/components/forms/FormDialog";
import { listClassStudents, listStandards, listTerms, listUnits } from "@/db/queries/classDetail";
import { getStudentGroups, listGroups } from "@/db/queries/groups";
import { getTask, listTaskScores } from "@/db/queries/tasks";
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
  const [task, roster, saved, terms, units, standards, groups, studentGroups] = await Promise.all([
    getTask(db, teacherId, cls, taskId),
    listClassStudents(db, teacherId, cls),
    listTaskScores(db, teacherId, taskId),
    listTerms(db, teacherId, cls),
    listUnits(db, teacherId, id),
    listStandards(db, teacherId, id),
    listGroups(db, teacherId, id),
    getStudentGroups(db, teacherId, id),
  ]);
  if (!task) notFound();

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
  const locale = await getLocale();
  const rules = { ...DEFAULT_RULES, passMark: cls.passMark ?? DEFAULT_RULES.passMark };
  const byStudent = new Map(saved.map((s) => [s.studentId, s]));

  return (
    <>
      <BackLink href={`/classes/${id}/tasks`} label={t("back")} />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl font-extrabold">{task.title}</h2>
        <div className="flex flex-wrap gap-2">
          <FormDialog
            wide
            trigger="edit"
            triggerLabel={t("edit")}
            title={t("editTitle")}
            action={editTask}
            hidden={{ classId: id, taskId: task.id }}
            formErrors={{ notFound: tErr("notFound") }}
            fields={await taskFields({ terms, units, standards, groups }, task)}
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
      <p className="text-sm text-muted-foreground">
        {[
          tTerm(String(task.termPosition)),
          // GROUP-3: each group's own date, or the task's.
          ...(task.groups.length > 0
            ? task.groups.map((g) => (g.dueOn ? `${g.name} ${formatDate(g.dueOn, locale)}` : g.name))
            : [task.dueOn && formatDate(task.dueOn, locale)]),
          task.unitTitle,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {task.description && (
          <div>
            <dt className="font-medium">{t("fields.description")}</dt>
            <dd className="text-muted-foreground">{task.description}</dd>
          </div>
        )}
        {task.criteria && (
          <div>
            <dt className="font-medium">{t("fields.criteria")}</dt>
            <dd className="whitespace-pre-line text-muted-foreground">{task.criteria}</dd>
          </div>
        )}
        {task.standards.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="font-medium">{t("fields.standards")}</dt>
            <dd>
              <ul className="list-disc pl-5 text-muted-foreground">
                {task.standards.map((s) => (
                  <li key={s.id}>{s.title}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      <Attachment
        classId={id}
        target={{ kind: "task", id: task.id }}
        teacherId={teacherId}
        current={task.attachmentName ? { name: task.attachmentName } : null}
      />

      <div className="mt-6">
        <GroupFilter
          groups={filterGroups}
          current={groupId}
          allLabel={tGroups("all")}
          href={(g) => `/classes/${id}/tasks/${task.id}${g ? `?group=${g}` : ""}`}
        />
        {assessed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
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
                score: s?.value != null ? formatGrade(s.value, locale) : "",
                status: s?.status ?? "graded",
                notes: s?.notes ?? "",
                passing: s?.value != null ? isPassing(s.value, rules) : null,
              };
            })}
          />
        )}
      </div>
    </>
  );
}
