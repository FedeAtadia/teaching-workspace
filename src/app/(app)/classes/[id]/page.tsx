import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listClassStudents } from "@/db/queries/classDetail";
import { loadClass } from "./data";

export default async function ClassStudentsPage({ params }: PageProps<"/classes/[id]">) {
  const { id } = await params;
  const { db, teacherId, cls } = await loadClass(id);
  const t = await getTranslations("classPage.students");
  const roster = await listClassStudents(db, teacherId, cls);

  if (roster.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{t("count", { count: roster.length })}</p>
      {/* NAV-2: each whole card opens the student's history. */}
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((s, i) => (
          <li key={s.id}>
            <Link
              href={`/students/${s.id}`}
              className="group flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border transition hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-extrabold text-chalk tabular-nums">
                {i + 1}
              </span>
              <span className="flex-1 font-bold">
                {s.lastName}, <span className="font-normal">{s.firstName}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
