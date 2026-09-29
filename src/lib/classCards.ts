import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import type { HomeCard } from "@/db/queries/home";
import { formatCourse } from "@/lib/courses";
import { formatDate } from "@/lib/format";

/** The texts a ClassCard shows for one class, in the teacher's language. */
export async function classCardProps() {
  const t = await getTranslations("dashboard.card");
  const tShift = await getTranslations("shifts");
  const locale = await getLocale();
  return (c: HomeCard, withSchool: boolean) => ({
    href: `/classes/${c.id}`,
    name: c.name,
    courseLine: [formatCourse(c.year, c.division), c.schoolYear, withSchool ? c.school : null].filter(Boolean).join(" · "),
    shift: tShift(c.shift),
    studentsText: t("students", { count: c.students }),
    progress: c.progress,
    progressText: t("progress", { progress: c.progress }),
    nextText: c.next
      ? c.next.dueOn
        ? t("next", { title: c.next.title, date: formatDate(c.next.dueOn, locale) })
        : t("nextUndated", { title: c.next.title })
      : c.tasks === 0
        ? t("noTasks")
        : t("allScored"),
  });
}
