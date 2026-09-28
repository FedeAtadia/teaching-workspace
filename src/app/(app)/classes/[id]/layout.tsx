import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
      <Link href="/classes" className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("back")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{cls.name}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {formatCourse(cls.year, cls.division)} · {tShift(cls.shift)} · {cls.schoolYear}
      </p>
      <ClassTabs
        tabs={[
          { href: base, label: t("tabs.students") },
          { href: `${base}/standards`, label: t("tabs.standards") },
          { href: `${base}/units`, label: t("tabs.units") },
        ]}
      />
      <div className="mt-6">{children}</div>
    </>
  );
}
