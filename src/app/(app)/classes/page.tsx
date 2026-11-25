import { getTranslations } from "next-intl/server";
import { AddClassDialog } from "@/components/classes/AddClassDialog";
import { ClassCard } from "@/components/classes/ClassCard";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { Eye } from "lucide-react";
import Link from "next/link";
import { listSharedWithMe } from "@/db/queries/shares";
import { requireTeacher } from "@/lib/auth";
import { formatCourse } from "@/lib/courses";
import { listCopySources } from "@/db/queries/copyClass";
import { copyLabels } from "@/lib/classCards";
import { listClasses, listSchools } from "@/db/queries/classes";
import { getHomeCards, type HomeCard } from "@/db/queries/home";
import { requireTeacherId } from "@/lib/auth";
import { classCardProps } from "@/lib/classCards";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function ClassesPage({ searchParams }: PageProps<"/classes">) {
  const t = await getTranslations("classes");
  const tShares = await getTranslations("shares");
  const tShift = await getTranslations("shifts");
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
  // CLASS-8: the archived classes have their own view, kept in the address.
  // SHARE-5: classes shared with this teacher have a view too.
  const asked = (await searchParams).view;
  const view = asked === "archived" ? "archived" : asked === "shared" ? "shared" : "active";
  const own = view === "shared" ? "active" : view;
  const [home, others, schools, cardProps, sharedWithMe] = await Promise.all([
    getHomeCards(db, teacherId, own),
    listClasses(db, teacherId, own === "archived" ? "active" : "archived"),
    listSchools(db, teacherId),
    classCardProps(),
    listSharedWithMe(db, await requireTeacher()),
  ]);
  const [copySources, copyLabel] = await Promise.all([listCopySources(db, teacherId), copyLabels()]);
  const counts = {
    active: own === "active" ? home.cards.length : others.length,
    archived: own === "archived" ? home.cards.length : others.length,
    shared: sharedWithMe.length,
  };
  const viewHref = { active: "/classes", archived: "/classes?view=archived", shared: "/classes?view=shared" };
  const chip =
    "flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm";

  // One section per school, in name order; within it, COURSE-3 order.
  const bySchool = new Map<string, HomeCard[]>();
  for (const s of schools) bySchool.set(s.name, []);
  for (const c of home.cards) bySchool.get(c.school)?.push(c);

  return (
    <PageHeader
      title={t("title")}
      action={
        <AddClassDialog
          defaultSchoolYear={new Date().getFullYear()}
          schools={schools.map((s) => s.name)}
          copySources={copySources.map((c) => ({ id: c.id, label: copyLabel(c, schools.length > 1) }))}
        />
      }
    >
      {(counts.archived > 0 || counts.shared > 0) && (
        <nav
          aria-label={t("views.label")}
          className="mb-6 inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1 ring-1 ring-border"
        >
          {(["active", "archived", "shared"] as const)
            .filter((v) => v === "active" || counts[v] > 0 || view === v)
            .map((v) => (
            <Link
              key={v}
              href={viewHref[v]}
              aria-current={view === v ? "page" : undefined}
              className={chip}
            >
              {t(`views.${v}`)}
              <span className="text-xs font-normal tabular-nums opacity-70">{counts[v]}</span>
            </Link>
          ))}
        </nav>
      )}
      {view === "archived" && <p className="mb-6 max-w-prose text-sm text-muted-foreground">{t("archivedHint")}</p>}
      {/* SHARE-5: by whom, read-only; an archived one says so. */}
      {view === "shared" && (
        <>
          <p className="mb-6 max-w-prose text-sm text-muted-foreground">{tShares("sharedHint")}</p>
          {sharedWithMe.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tShares("sharedEmpty")}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sharedWithMe.map((c) => (
                <li key={c.shareId}>
                  <Link
                    href={`/classes/${c.classId}`}
                    className="flex h-full flex-col gap-2 rounded-2xl bg-card p-5 ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{formatCourse(c.year, c.division)}</Badge>
                      {c.archived && <Badge tone="outline">{tShares("archived")}</Badge>}
                    </span>
                    <span className="font-heading text-lg leading-snug font-bold">{c.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {[tShift(c.shift), c.schoolYear, c.school].join(" · ")}
                    </span>
                    <span className="mt-auto flex items-center gap-1.5 pt-2 text-sm">
                      <Eye className="size-4 text-highlight" aria-hidden />
                      {tShares("by", { owner: c.ownerName ?? tShares("someone") })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {view === "shared" ? null : home.cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">{view === "archived" ? t("emptyArchived") : t("empty")}</p>
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
