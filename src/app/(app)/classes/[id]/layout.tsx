import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { ClassTabs } from "@/components/classes/ClassTabs";
import { formatCourse } from "@/lib/courses";
import { loadClass } from "./data";

export default async function ClassLayout({ children, params }: LayoutProps<"/classes/[id]">) {
  const { id } = await params;
  const { cls } = await loadClass(id);
  const t = await getTranslations("classPage");
  const tShift = await getTranslations("shifts");
  const base = `/classes/${id}`;

  return (
    <>
      <BackLink href="/classes" label={t("back")} />
      <h1 className="mt-3 text-3xl font-extrabold">{cls.name}</h1>
      <p className="mt-1 mb-5 text-muted-foreground">
        {formatCourse(cls.year, cls.division)} · {tShift(cls.shift)} · {cls.schoolYear} · {cls.school}
      </p>
      <ClassTabs
        tabs={[
          { href: base, label: t("tabs.students"), icon: "students" },
          { href: `${base}/standards`, label: t("tabs.standards"), icon: "standards" },
          { href: `${base}/units`, label: t("tabs.units"), icon: "units" },
          { href: `${base}/tasks`, label: t("tabs.tasks"), icon: "tasks" },
          { href: `${base}/grades`, label: t("tabs.grades"), icon: "grades" },
        ]}
      />
      <div className="mt-6">{children}</div>
    </>
  );
}
