import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "cn";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Initials } from "@/components/Initials";
import { AdaptationButton } from "@/components/classes/Adaptation";
import { BringStudentsDialog } from "@/components/classes/BringStudentsDialog";
import { GroupFilter } from "@/components/classes/GroupFilter";
import { StudentGroupSelect } from "@/components/classes/StudentGroupSelect";
import { FormDialog, type FieldSpec } from "@/components/forms/FormDialog";
import { Badge } from "@/components/ui/badge";
import { getAdaptations } from "@/db/queries/adaptations";
import { listClassStudents } from "@/db/queries/classDetail";
import { getStudentGroups, listGroups } from "@/db/queries/groups";
import { listNextYearCandidates } from "@/db/queries/nextYear";
import { WEEKDAYS } from "@/lib/calendar";
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
  const tDay = await getTranslations("weekdays");
  const tDayShort = await getTranslations("weekdaysShort");
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
  const groupFields = (current?: { name: string; days: string | null; weekdays: number[] }): FieldSpec[] => [
    { kind: "text", name: "name", label: tGroups("fields.name"), maxLength: 60, defaultValue: current?.name },
    {
      kind: "checkboxes",
      name: "weekdays",
      label: tGroups("fields.weekdays"),
      hint: tGroups("fields.weekdaysHint"),
      inline: true,
      options: WEEKDAYS.map((d) => ({ value: String(d), label: tDay(String(d)) })),
      defaultValue: current?.weekdays.map(String),
    },
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
    <section className="mb-5 rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="font-heading text-lg font-bold">{tGroups("title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{tGroups("intro")}</p>
      {groups.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted/60 py-1.5 pr-1.5 pl-4 text-sm"
            >
              <span className="font-bold">{g.name}</span>
              <Badge tone="accent">{tGroups("students", { count: g.students })}</Badge>
              {(g.weekdays.length > 0 || g.days) && (
                <span className="text-muted-foreground">
                  {[g.weekdays.map((d) => tDayShort(String(d))).join(", "), g.days].filter(Boolean).join(" · ")}
                </span>
              )}
              <span className="ml-auto flex shrink-0">
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
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
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
  const hasGroups = groups.length > 0;
  // Desktop: a table of three (or two, without groups) columns; phone: one card-like row each.
  const columns = hasGroups ? "md:grid-cols-[minmax(0,1fr)_14rem_10rem]" : "md:grid-cols-[minmax(0,1fr)_10rem]";
  const head = "text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase";
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-bold">{t("count", { count: shown.length })}</h2>
        {bring}
      </div>
      {groupsSection}
      <GroupFilter
        groups={groups}
        current={groupId}
        allLabel={tGroups("all")}
        href={(g) => `/classes/${id}${g ? `?group=${g}` : ""}`}
      />
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <div className={cn("hidden gap-x-4 border-b bg-muted px-4 py-3 md:grid", columns)} aria-hidden>
          <span className={head}>{t("student")}</span>
          {hasGroups && <span className={head}>{t("group")}</span>}
          <span className={cn(head, "text-right")}>{t("adaptation")}</span>
        </div>
        <ol className="divide-y">
          {shown.map((s) => {
            const name = `${s.lastName}, ${s.firstName}`;
            return (
              // NAV-2: the name's link stretches over the whole row; its controls sit above it.
              <li
                key={s.id}
                className={cn(
                  "relative flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/60 has-[a:focus-visible]:bg-muted md:grid md:gap-x-4",
                  columns,
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Initials firstName={s.firstName} lastName={s.lastName} className="size-9" />
                  <Link
                    href={`/students/${s.id}`}
                    className="min-w-0 truncate font-bold outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                  >
                    {s.lastName}, <span className="font-normal">{s.firstName}</span>
                  </Link>
                </div>
                <div className="relative z-10 md:order-last md:justify-self-end">
                  <AdaptationButton
                    classId={id}
                    studentId={s.id}
                    studentName={name}
                    notes={adaptations.get(s.id) ?? null}
                  />
                </div>
                {hasGroups && (
                  <div className="relative z-10 w-full pl-12 md:w-auto md:pl-0">
                    <StudentGroupSelect
                      classId={id}
                      studentId={s.id}
                      studentName={name}
                      current={studentGroups.get(s.id) ?? null}
                      groups={groups}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
