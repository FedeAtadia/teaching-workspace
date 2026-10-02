import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { StudentExams } from "@/components/classes/StudentExams";
import { getDb } from "@/db";
import { listOwed } from "@/db/queries/yearEnd";
import { requireTeacherId } from "@/lib/auth";
import { formatCourse } from "@/lib/courses";
import { formatGrade } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** EXAM-3: every class a student still owes, from every school year. */
export default async function ExamsPage() {
  const t = await getTranslations("exams");
  const tShift = await getTranslations("shifts");
  const tCommon = await getTranslations("common");

  if (!isSupabaseConfigured()) {
    return (
      <PageHeader title={t("title")}>
        <p className="text-sm text-muted-foreground">{tCommon("notConfigured")}</p>
      </PageHeader>
    );
  }

  const owed = await listOwed(getDb(), await requireTeacherId());
  const locale = await getLocale();

  return (
    <PageHeader title={t("title")}>
      <p className="mb-6 max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
      {owed.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-8">
          {owed.map((c) => (
            <section key={c.classId}>
              <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3">
                <Link href={`/classes/${c.classId}/closing`} className="text-lg font-extrabold hover:underline">
                  {c.name}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {formatCourse(c.year, c.division)} · {tShift(c.shift)} · {c.schoolYear} · {c.school}
                </span>
              </h2>
              <ul className="grid gap-3">
                {c.students.map(({ student, finalGrade, exams }) => {
                  const name = `${student.lastName}, ${student.firstName}`;
                  return (
                    <li key={student.id} className="grid gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
                      <p className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link href={`/students/${student.id}`} className="font-extrabold hover:underline">
                          {name}
                        </Link>
                        <span className="text-sm">
                          {t("finalGrade")}:{" "}
                          <span className="font-bold text-destructive">{formatGrade(finalGrade, locale)}</span>
                        </span>
                      </p>
                      <StudentExams classId={c.classId} studentId={student.id} studentName={name} exams={exams} owed />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageHeader>
  );
}
