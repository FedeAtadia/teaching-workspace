import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { EditClassDialog } from "@/components/classes/AddClassDialog";
import { ClassTabs } from "@/components/classes/ClassTabs";
import { getClassCounts, listSchools } from "@/db/queries/classes";
import { formatCourse } from "@/lib/courses";
import { removeClass } from "./actions";
import { loadClass } from "./data";

export default async function ClassLayout({ children, params }: LayoutProps<"/classes/[id]">) {
  const { id } = await params;
  const { db, teacherId, cls } = await loadClass(id);
  const [counts, schools] = await Promise.all([getClassCounts(db, teacherId, id), listSchools(db, teacherId)]);
  const t = await getTranslations("classPage");
  const tShift = await getTranslations("shifts");
  const base = `/classes/${id}`;
  const course = `${formatCourse(cls.year, cls.division)} · ${tShift(cls.shift)} · ${cls.schoolYear}`;
  const locale = await getLocale();
  // CLASS-7: only what the class actually has, e.g. "3 tareas, 12 notas cargadas y 1 unidad".
  const items = (["tasks", "scores", "units", "standards"] as const)
    .filter((key) => (counts?.[key] ?? 0) > 0)
    .map((key) => t(`deleteClass.${key}`, { count: counts![key] }));

  return (
    <>
      <BackLink href="/classes" label={t("back")} />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{cls.name}</h1>
        <div className="flex flex-wrap gap-2">
          <EditClassDialog
            classId={id}
            current={{
              school: cls.school,
              name: cls.name,
              year: cls.year,
              division: cls.division,
              shift: cls.shift,
              schoolYear: cls.schoolYear,
            }}
            schools={schools.map((s) => s.name)}
            otherClasses={counts?.otherClasses ?? []}
          />
          <ConfirmDeleteButton
            label={t("deleteClass.button")}
            title={t("deleteClass.title", { name: cls.name, course })}
            body={[
              items.length === 0
                ? t("deleteClass.empty")
                : t("deleteClass.body", { items: new Intl.ListFormat(locale).format(items) }),
              counts && counts.files > 0 && t("deleteClass.withFiles", { count: counts.files }),
              t("deleteClass.studentsStay"),
            ]
              .filter(Boolean)
              .join(" ")}
            action={removeClass.bind(null, { classId: id })}
          />
        </div>
      </div>
      <p className="mt-1 mb-5 text-muted-foreground">
        {course} · {cls.school}
      </p>
      <ClassTabs
        tabs={[
          { href: base, label: t("tabs.students"), icon: "students" },
          { href: `${base}/standards`, label: t("tabs.standards"), icon: "standards" },
          { href: `${base}/units`, label: t("tabs.units"), icon: "units" },
          { href: `${base}/tasks`, label: t("tabs.tasks"), icon: "tasks" },
          { href: `${base}/grades`, label: t("tabs.grades"), icon: "grades" },
          { href: `${base}/term-grades`, label: t("tabs.termGrades"), icon: "termGrades" },
          { href: `${base}/closing`, label: t("tabs.closing"), icon: "closing" },
        ]}
      />
      <div className="mt-6">{children}</div>
    </>
  );
}
