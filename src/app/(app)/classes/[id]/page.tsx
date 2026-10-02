import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AdaptationButton } from "@/components/classes/Adaptation";
import { BringStudentsDialog } from "@/components/classes/BringStudentsDialog";
import { GroupFilter } from "@/components/classes/GroupFilter";
import { StudentGroupSelect } from "@/components/classes/StudentGroupSelect";
import { FormDialog, type FieldSpec } from "@/components/forms/FormDialog";
import { getAdaptations } from "@/db/queries/adaptations";
import { listClassStudents } from "@/db/queries/classDetail";
import { getStudentGroups, listGroups } from "@/db/queries/groups";
import { listNextYearCandidates } from "@/db/queries/nextYear";
import { formatCourse } from "@/lib/courses";
import { addGroup, editGroup, removeGroup } from "./actions";
import { loadClass } from "./data";

/** ROSTER-1, NEXT-1, GROUP-1, GROUP-2, GROUP-6, ADAPT-1 */
export default async function ClassStudentsPage({ params, searchParams }: PageProps<"/classes/[id]">) {
  const { id } = await params;
  const { group } = await searchParams;
  const { db, teacherId, cls } = await loadClass(id);
  const t = await getTranslations("classPage.students");
  const tGroups = await getTranslations("groups");
  const tNext = await getTranslations("nextYear");
  const tShift = await getTranslations("shifts");
  const [roster, candidates, groups, studentGroups, adaptations] = await Promise.all([
    listClassStudents(db, teacherId, cls),
    listNextYearCandidates(db, teacherId, cls),
    listGroups(db, teacherId, id),
    getStudentGroups(db, teacherId, id),
    getAdaptations(db, teacherId, id),
  ]);
  const groupId = typeof group === "string" && groups.some((g) => g.id === group) ? group : undefined;
  const shown = groupId ? roster.filter((s) => studentGroups.get(s.id) === groupId) : roster;

  // NEXT-1: only when someone from last year can come into this course.
  const bring =
    candidates.length > 0 ? (
      <BringStudentsDialog
        classId={id}
        previousYear={String(Number(cls.schoolYear) - 1)}
        groups={candidates.map((g) => ({
          courseId: g.courseId,
          label: `${formatCourse(g.year, g.division)} · ${tShift(g.shift)} · ${g.schoolYear}`,
          reason: tNext(`reasons.${g.outcome}`),
          students: g.students.map((s) => ({ id: s.id, name: `${s.lastName}, ${s.firstName}` })),
        }))}
      />
    ) : null;

  // GROUP-1: the same form adds a group or, with its current values, changes one.
  const groupFields = (current?: { name: string; days: string | null }): FieldSpec[] => [
    { kind: "text", name: "name", label: tGroups("fields.name"), maxLength: 60, defaultValue: current?.name },
    {
      kind: "text",
      name: "days",
      label: tGroups("fields.days"),
      maxLength: 120,
      placeholder: tGroups("fields.daysPlaceholder"),
      defaultValue: current?.days ?? undefined,
    },
  ];
  const groupErrors = { duplicate: tGroups("errors.duplicate"), notFound: tGroups("errors.notFound") };

  const groupsSection = (
    <section className="mb-5 rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-extrabold">{tGroups("title")}</h2>
        <FormDialog
          trigger="addSmall"
          triggerLabel={tGroups("add")}
          title={tGroups("addTitle")}
          action={addGroup}
          hidden={{ classId: id }}
          formErrors={groupErrors}
          fields={groupFields()}
        />
      </div>
      {groups.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{tGroups("intro")}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center gap-1 rounded-full bg-muted py-0.5 pr-0.5 pl-3.5 text-sm">
              <span className="font-bold">{g.name}</span>
              {g.days && <span className="text-muted-foreground">· {g.days}</span>}
              <span className="text-muted-foreground">· {tGroups("students", { count: g.students })}</span>
              <FormDialog
                trigger="editIcon"
                triggerLabel={tGroups("edit")}
                title={tGroups("editTitle")}
                action={editGroup}
                hidden={{ classId: id, groupId: g.id }}
                formErrors={groupErrors}
                fields={groupFields(g)}
              />
              <ConfirmDeleteButton
                iconOnly
                label={tGroups("delete")}
                title={tGroups("deleteTitle", { name: g.name })}
                body={[
                  tGroups("deleteBody", { count: g.students }),
                  g.onlyTasks > 0 && tGroups("deleteTasks", { count: g.onlyTasks }),
                ]
                  .filter(Boolean)
                  .join(" ")}
                action={removeGroup.bind(null, { classId: id, groupId: g.id })}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  if (roster.length === 0) {
    return (
      <div className="grid justify-items-start gap-4">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
        {bring}
      </div>
    );
  }
  return (
    <>
      {groupsSection}
      <GroupFilter
        groups={groups}
        current={groupId}
        allLabel={tGroups("all")}
        href={(g) => `/classes/${id}${g ? `?group=${g}` : ""}`}
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("count", { count: shown.length })}</p>
        {bring}
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s, i) => {
          const name = `${s.lastName}, ${s.firstName}`;
          return (
            // NAV-2: the name's link stretches over the whole card; its controls sit above it.
            <li
              key={s.id}
              className="group relative flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl bg-card p-3 ring-1 ring-border transition hover:ring-primary has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-extrabold text-chalk tabular-nums">
                {i + 1}
              </span>
              <Link
                href={`/students/${s.id}`}
                className="min-w-0 flex-1 font-bold outline-none after:absolute after:inset-0 after:content-['']"
              >
                {s.lastName}, <span className="font-normal">{s.firstName}</span>
              </Link>
              <div className="relative z-10">
                <AdaptationButton
                  classId={id}
                  studentId={s.id}
                  studentName={name}
                  notes={adaptations.get(s.id) ?? null}
                />
              </div>
              {groups.length > 0 ? (
                <div className="relative z-10">
                  <StudentGroupSelect
                    classId={id}
                    studentId={s.id}
                    studentName={name}
                    current={studentGroups.get(s.id) ?? null}
                    groups={groups}
                  />
                </div>
              ) : (
                <ChevronRight
                  className="size-4 text-muted-foreground transition group-hover:translate-x-0.5"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
