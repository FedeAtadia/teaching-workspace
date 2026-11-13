import "server-only";
import { getTranslations } from "next-intl/server";
import type { CopySource } from "@/db/queries/copyClass";
import type { HomeCard } from "@/db/queries/home";
import { formatCourse } from "@/lib/courses";
import { formatDate } from "@/lib/format";

/** The texts a ClassCard shows for one class, in the teacher's language. */
export async function classCardProps() {
  const t = await getTranslations("dashboard.card");
  const tShift = await getTranslations("shifts");
  return (c: HomeCard, withSchool: boolean) => ({
    href: `/classes/${c.id}`,
    name: c.name,
    course: formatCourse(c.year, c.division),
    courseLine: [c.schoolYear, withSchool ? c.school : null].filter(Boolean).join(" · "),
    shift: tShift(c.shift),
    studentsText: t("students", { count: c.students }),
    progress: c.progress,
    progressText: t("progress", { progress: c.progress }),
    nextText: c.next
      ? c.next.dueOn
        ? t("next", { title: c.next.title, date: formatDate(c.next.dueOn) })
        : t("nextUndated", { title: c.next.title })
      : c.tasks === 0
        ? t("noTasks")
        : t("allScored"),
  });
}

/** COPY-1: how a class reads in the list to copy from: "Matemática · 5° A · Mañana · 2026". */
export async function copyLabels() {
  const tShift = await getTranslations("shifts");
  return (c: CopySource, withSchool: boolean) =>
    [c.name, formatCourse(c.year, c.division), tShift(c.shift), c.schoolYear, withSchool ? c.school : null]
      .filter(Boolean)
      .join(" · ");
}
