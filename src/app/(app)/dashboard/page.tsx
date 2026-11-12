import { BookOpen, CalendarCheck, CalendarX, Check, ClipboardCheck, Info, PencilLine, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { getTranslations } from "next-intl/server";
import { AddClassDialog } from "@/components/classes/AddClassDialog";
import { ClassCard } from "@/components/classes/ClassCard";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { listSchools } from "@/db/queries/classes";
import { getHomeCards, getTodayClasses, type TodayClass } from "@/db/queries/home";
import { runRetention } from "@/db/queries/retention";
import { removeStoredFiles } from "@/lib/supabase/storage";
import { Button, buttonVariants } from "@/components/ui/button";
import { dismissGraduatesNotice } from "./actions";
import { requireTeacherId } from "@/lib/auth";
import { todayInArgentina, weekdayOf } from "@/lib/calendar";
import { classCardProps } from "@/lib/classCards";
import { formatDate } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** HOME-1..4, EXAM-4 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");
  const tWeekday = await getTranslations("weekdays");

  if (!isSupabaseConfigured()) {
    return (
      <>
        <h1 className="mb-2 text-4xl font-bold tracking-tight">{t("greeting")}</h1>
        <p className="text-muted-foreground">{tCommon("notConfigured")}</p>
      </>
    );
  }

  const db = getDb();
  const teacherId = await requireTeacherId();
  const today = todayInArgentina();
  // KEEP-1: graduates whose day has come are deleted before anything is counted.
  const retention = await runRetention(db, teacherId, today);
  await removeStoredFiles(retention.attachmentPaths);
  const [home, schools, cardProps, todayClasses] = await Promise.all([
    getHomeCards(db, teacherId),
    listSchools(db, teacherId),
    classCardProps(),
    getTodayClasses(db, teacherId, today),
  ]);
  const severalSchools = schools.length > 1;
  const { stats } = home;
  const hasToday = todayClasses.length > 0;

  return (
    <div className="grid gap-8 sm:gap-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("greeting")}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{t("subtitle")}</p>
      </header>

      {/* KEEP-3, KEEP-4 */}
      {(retention.soon || retention.deleted) && (
        <div className="grid gap-3">
          {retention.soon && (
            <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-alert-soft p-4 ring-1 ring-destructive/30">
              <Info className="size-5 shrink-0 text-destructive" aria-hidden />
              <p className="min-w-0 flex-1 basis-64">
                {t("graduates.soon", { count: retention.soon.count, date: formatDate(retention.soon.firstOn) })}
              </p>
              <span className="flex flex-wrap gap-2">
                <Link href="/students?view=graduates" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {t("graduates.soonSee")}
                </Link>
                <a href="/settings/export" download className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {t("graduates.soonDownload")}
                </a>
              </span>
            </div>
          )}
          {retention.deleted && (
            <form
              action={dismissGraduatesNotice}
              role="status"
              className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-card p-4 ring-1 ring-border"
            >
              <Info className="size-5 shrink-0 text-highlight" aria-hidden />
              <p className="min-w-0 flex-1 basis-64">
                {t("graduates.deleted", { count: retention.deleted.count, date: formatDate(retention.deleted.on) })}
              </p>
              <Button type="submit" variant="outline" size="sm">
                {t("graduates.dismiss")}
              </Button>
            </form>
          )}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label={t("statLabels.classes")} value={stats.classes} unit={t("stats.classes", { count: stats.classes })} icon={BookOpen} />
        <StatTile label={t("statLabels.students")} value={stats.students} unit={t("stats.students", { count: stats.students })} icon={Users} />
        <StatTile
          label={t("statLabels.pending")}
          value={stats.pending}
          unit={t("stats.pending", { count: stats.pending })}
          icon={PencilLine}
          tone={stats.pending > 0 ? "accent" : "default"}
        />
        <StatTile
          label={t("statLabels.owed")}
          value={stats.owed}
          unit={t("stats.owed", { count: stats.owed })}
          icon={ClipboardCheck}
          tone={stats.owed > 0 ? "alert" : "default"}
          href="/exams"
        />
      </dl>

      {/* With classes today: Hoy on the left, the classes in a column on the right. */}
      <div className={cn("grid gap-8 sm:gap-10", hasToday && "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]")}>
        {/* HOME-4 */}
        {hasToday && (
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold">{t("today.title")}</h2>
              <Badge tone="accent" className="tabular-nums">
                {tWeekday(String(weekdayOf(today)))} {formatDate(today)}
              </Badge>
            </div>
            <ul className="grid gap-3">
              {todayClasses.map((c) => (
                <li key={c.classId}>
                  <TodayRow c={c} href={`/classes/${c.classId}/attendance/${today}`} label={t(`today.${c.state}`)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="min-w-0">
          <h2 className="mb-4 text-2xl font-bold">{t("myClasses")}</h2>
          {home.cards.length === 0 && <p className="mb-4 text-muted-foreground">{t("empty")}</p>}
          <div className={cn("grid gap-4", !hasToday && "sm:grid-cols-2 lg:grid-cols-3")}>
            {home.cards.map((c) => (
              <ClassCard key={c.id} {...cardProps(c, severalSchools)} />
            ))}
            <AddClassDialog
              appearance="card"
              defaultSchoolYear={new Date().getFullYear()}
              schools={schools.map((s) => s.name)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * HOME-4, NAV-2: one of today's classes as a single link. Still to take: an
 * accent edge and the button; taken: a quiet badge; not held: struck through.
 */
function TodayRow({ c, href, label }: { c: TodayClass; href: string; label: string }) {
  const pending = c.state === "pending";
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-2xl bg-card p-3 pr-4 text-card-foreground ring-1 transition hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        pending ? "pl-4 ring-primary/50" : "ring-border",
      )}
    >
      {pending && <span className="absolute inset-y-0 left-0 w-1.5 bg-primary" aria-hidden />}
      <span
        className={cn(
          "flex h-14 min-w-16 shrink-0 items-center justify-center rounded-xl px-2 font-heading text-lg font-bold",
          pending ? "bg-highlight-soft text-highlight" : "bg-muted text-muted-foreground",
        )}
      >
        {c.course}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 basis-32 truncate text-lg font-semibold",
          c.state === "notHeld" && "text-muted-foreground line-through",
        )}
      >
        {c.name}
      </span>
      {pending ? (
        <span className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
          <CalendarCheck className="size-4" aria-hidden />
          {label}
        </span>
      ) : c.state === "taken" ? (
        <Badge tone="accent" className="ml-auto">
          <Check aria-hidden />
          {label}
        </Badge>
      ) : (
        <Badge tone="neutral" className="ml-auto">
          <CalendarX aria-hidden />
          {label}
        </Badge>
      )}
    </Link>
  );
}
