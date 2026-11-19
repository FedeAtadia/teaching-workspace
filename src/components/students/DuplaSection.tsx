import { UsersRound } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ResultLabel } from "@/components/classes/StudentExams";
import { Badge } from "@/components/ui/badge";
import type { SharedStudentHistory } from "@/db/queries/sharedStudent";
import { formatCourse } from "@/lib/courses";
import { formatGrade } from "@/lib/format";

/**
 * DUPLA-1: on one's own student's page, the same student in each class a
 * partner shared: by cuatrimestre the grade (or the average so far) and the
 * attendance, then the final grade and the result. Read-only; the name opens
 * the partner's page for them (SHARE-6).
 */
export async function DuplaSection({ views }: { views: SharedStudentHistory[] }) {
  if (views.length === 0) return null;
  const t = await getTranslations("dupla");
  const tShares = await getTranslations("shares");
  const tTerm = await getTranslations("terms");
  const locale = await getLocale();
  const grade = (v: number | null) => (v === null ? "—" : formatGrade(v, locale));

  return (
    <section className="mb-8 grid gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <UsersRound className="size-5 text-highlight" aria-hidden />
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {views.flatMap((view) =>
          view.courses.flatMap((course) =>
            course.classes.map((cls) => (
              <article key={cls.id} className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/students/${view.student.id}`}
                      className="font-heading text-lg leading-tight font-bold underline-offset-4 hover:underline"
                    >
                      {cls.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {formatCourse(course.year, course.division)} · {course.schoolYear} ·{" "}
                      {tShares("by", { owner: view.ownerName ?? tShares("someone") })}
                    </p>
                  </div>
                  {cls.result.kind !== "pending" && (
                    <Badge tone={cls.result.kind === "owed" ? "alert" : "accent"}>
                      <ResultLabel result={cls.result} />
                    </Badge>
                  )}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm tabular-nums">
                  {cls.terms.map((term) => (
                    <div key={term.position} className="rounded-xl bg-muted/60 px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{tTerm(String(term.position))}</dt>
                      <dd className="font-bold">{grade(term.grade ?? term.suggestion.average)}</dd>
                      {term.attendance !== null && (
                        <dd className="text-xs text-muted-foreground">{t("attendance", { rate: term.attendance })}</dd>
                      )}
                    </div>
                  ))}
                  <div className="rounded-xl bg-muted/60 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{t("final")}</dt>
                    <dd className="font-bold">{grade(cls.finalGrade)}</dd>
                  </div>
                </dl>
              </article>
            )),
          ),
        )}
      </div>
    </section>
  );
}
