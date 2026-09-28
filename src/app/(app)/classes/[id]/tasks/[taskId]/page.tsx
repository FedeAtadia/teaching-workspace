import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { DeleteTaskButton } from "@/components/classes/DeleteTaskButton";
import { ScoresForm } from "@/components/classes/ScoresForm";
import { TaskAttachment } from "@/components/classes/TaskAttachment";
import { listClassStudents } from "@/db/queries/classDetail";
import { getTask, listTaskScores } from "@/db/queries/tasks";
import { formatDate, formatGrade } from "@/lib/format";
import { DEFAULT_RULES, isPassing } from "@/lib/grading";
import { loadClass } from "../../data";

export default async function TaskPage({ params }: PageProps<"/classes/[id]/tasks/[taskId]">) {
  const { id, taskId } = await params;
  const { db, teacherId, cls } = await loadClass(id);
  const [task, roster, saved] = await Promise.all([
    getTask(db, teacherId, cls, taskId),
    listClassStudents(db, teacherId, cls),
    listTaskScores(db, teacherId, taskId),
  ]);
  if (!task) notFound();

  const t = await getTranslations("classPage.tasks");
  const tTerm = await getTranslations("terms");
  const locale = await getLocale();
  const rules = { ...DEFAULT_RULES, passMark: cls.passMark ?? DEFAULT_RULES.passMark };
  const byStudent = new Map(saved.map((s) => [s.studentId, s]));

  return (
    <>
      <Link href={`/classes/${id}/tasks`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("back")}
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-semibold">{task.title}</h2>
        <DeleteTaskButton
          classId={id}
          taskId={task.id}
          title={task.title}
          scored={saved.filter((s) => s.value !== null || s.status !== "graded").length}
          hasFile={task.attachmentPath !== null}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {[tTerm(String(task.termPosition)), task.dueOn && formatDate(task.dueOn, locale), task.unitTitle]
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

      <TaskAttachment
        classId={id}
        taskId={task.id}
        teacherId={teacherId}
        current={task.attachmentName ? { name: task.attachmentName } : null}
      />

      <div className="mt-6">
        {roster.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
        ) : (
          <ScoresForm
            classId={id}
            taskId={task.id}
            rows={roster.map((student) => {
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
