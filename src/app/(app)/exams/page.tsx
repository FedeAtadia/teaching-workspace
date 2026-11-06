import { ChevronRight, CircleAlert } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Initials } from "@/components/Initials";
import { PageHeader } from "@/components/PageHeader";
import { ExamList, ExamsLabel, RecordExamButton } from "@/components/classes/StudentExams";
import { Badge } from "@/components/ui/badge";
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
        <div className="grid gap-10">
          {owed.map((c) => (
            <section key={c.classId}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl font-bold tracking-tight">{c.name}</span>
                  <Link
                    href={`/classes/${c.classId}/closing`}
                    className="inline-flex items-center gap-0.5 rounded-md text-sm font-semibold text-highlight hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {t("closingLink")}
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {formatCourse(c.year, c.division)} · {tShift(c.shift)} · {c.schoolYear} · {c.school}
                  </span>
                </h2>
                <Badge tone="alert">{t("pending", { count: c.students.length })}</Badge>
              </div>
              <ul className="grid gap-4">
                {c.students.map(({ student, finalGrade, exams }) => {
                  const name = `${student.lastName}, ${student.firstName}`;
                  return (
                    <li
                      key={student.id}
                      className="relative grid gap-4 overflow-hidden rounded-2xl bg-card p-4 pl-5 ring-1 ring-border sm:p-6 sm:pl-7"
                    >
                      {/* The red edge: this class is still owed. */}
                      <span className="absolute inset-y-0 left-0 w-1 bg-alert" aria-hidden />
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Initials
                            firstName={student.firstName}
                            lastName={student.lastName}
                            className="size-11 text-sm"
                          />
                          <div className="grid min-w-0 justify-items-start gap-1">
                            <Link
                              href={`/students/${student.id}`}
                              className="text-lg leading-tight font-bold hover:underline"
                            >
                              {name}
                            </Link>
                            <Badge tone="alert" className="tabular-nums">
                              <CircleAlert aria-hidden />
                              {t("finalGradeBadge", { grade: formatGrade(finalGrade, locale) })}
                            </Badge>
                          </div>
                        </div>
                        <RecordExamButton classId={c.classId} studentId={student.id} studentName={name} />
                      </div>
                      {exams.length > 0 && (
                        <div className="grid gap-2">
                          <ExamsLabel>{t("history")}</ExamsLabel>
                          <ExamList classId={c.classId} studentName={name} exams={exams} owed />
                        </div>
                      )}
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
