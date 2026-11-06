import { getTranslations } from "next-intl/server";
import { AddClassDialog } from "@/components/classes/AddClassDialog";
import { ClassCard } from "@/components/classes/ClassCard";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { listSchools } from "@/db/queries/classes";
import { getHomeCards, type HomeCard } from "@/db/queries/home";
import { requireTeacherId } from "@/lib/auth";
import { classCardProps } from "@/lib/classCards";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function ClassesPage() {
  const t = await getTranslations("classes");
  const tCommon = await getTranslations("common");

  if (!isSupabaseConfigured()) {
    return (
      <PageHeader title={t("title")}>
        <p className="text-sm text-muted-foreground">{tCommon("notConfigured")}</p>
      </PageHeader>
    );
  }

  const db = getDb();
  const teacherId = await requireTeacherId();
  const [home, schools, cardProps] = await Promise.all([
    getHomeCards(db, teacherId),
    listSchools(db, teacherId),
    classCardProps(),
  ]);

  // One section per school, in name order; within it, COURSE-3 order.
  const bySchool = new Map<string, HomeCard[]>();
  for (const s of schools) bySchool.set(s.name, []);
  for (const c of home.cards) bySchool.get(c.school)?.push(c);

  return (
    <PageHeader
      title={t("title")}
      action={<AddClassDialog defaultSchoolYear={new Date().getFullYear()} schools={schools.map((s) => s.name)} />}
    >
      {home.cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-10">
          {[...bySchool.entries()]
            .filter(([, cards]) => cards.length > 0)
            .map(([school, cards]) => (
              <section key={school}>
                <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="text-xl font-bold tracking-tight">{school}</h2>
                  <Badge>{t("count", { count: cards.length })}</Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cards.map((c) => (
                    <ClassCard key={c.id} {...cardProps(c, false)} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </PageHeader>
  );
}
