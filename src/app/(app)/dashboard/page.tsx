import { CalendarCheck, Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { getTranslations } from "next-intl/server";
import { AddClassDialog } from "@/components/classes/AddClassDialog";
import { ClassCard } from "@/components/classes/ClassCard";
import { getDb } from "@/db";
import { listSchools } from "@/db/queries/classes";
import { getHomeCards, getTodayClasses, type TodayClass } from "@/db/queries/home";
import { requireTeacherId } from "@/lib/auth";
import { todayInArgentina } from "@/lib/calendar";
import { classCardProps } from "@/lib/classCards";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** HOME-1..4, EXAM-4 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");

  if (!isSupabaseConfigured()) {
    return (
      <>
        <h1 className="mb-2 text-3xl font-bold">{t("greeting")}</h1>
        <p className="text-muted-foreground">{tCommon("notConfigured")}</p>
      </>
    );
  }

  const db = getDb();
  const teacherId = await requireTeacherId();
  const today = todayInArgentina();
  const [home, schools, cardProps, todayClasses] = await Promise.all([
    getHomeCards(db, teacherId),
    listSchools(db, teacherId),
    classCardProps(),
    getTodayClasses(db, teacherId, today),
  ]);
  const severalSchools = schools.length > 1;

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">{t("greeting")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat value={home.stats.classes} label={t("stats.classes", { count: home.stats.classes })} />
        <Stat value={home.stats.students} label={t("stats.students", { count: home.stats.students })} />
        <Stat value={home.stats.pending} label={t("stats.pending", { count: home.stats.pending })} highlight />
        <Stat value={home.stats.owed} label={t("stats.owed", { count: home.stats.owed })} href="/exams" />
      </dl>

      {/* HOME-4 */}
      {todayClasses.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-muted-foreground">{t("today.title")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todayClasses.map((c) => (
              <li key={c.classId}>
                <TodayLink c={c} href={`/classes/${c.classId}/attendance/${today}`} label={t(`today.${c.state}`)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold text-muted-foreground">{t("myClasses")}</h2>
        {home.cards.length === 0 && <p className="mb-4 text-muted-foreground">{t("empty")}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}

/** HOME-4: the accent button while today is still to take; a quiet card once it's saved. */
function TodayLink({ c, href, label }: { c: TodayClass; href: string; label: string }) {
  const pending = c.state === "pending";
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        pending
          ? "bg-primary text-primary-foreground hover:brightness-95"
          : "bg-card text-card-foreground ring-1 ring-border hover:ring-primary",
      )}
    >
      {pending ? (
        <CalendarCheck className="size-6 shrink-0" aria-hidden />
      ) : (
        <Check className="size-6 shrink-0 text-highlight" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        <span className={cn("block truncate text-sm", pending ? "font-semibold" : "text-muted-foreground")}>
          {c.name} · {c.course}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0" aria-hidden />
    </Link>
  );
}

function Stat({
  value,
  label,
  highlight = false,
  href,
}: {
  value: number;
  label: string;
  /** The tile to look at: tinted in the accent. */
  highlight?: boolean;
  /** The whole tile opens this page (NAV-2). */
  href?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col-reverse rounded-2xl px-4 py-3 ring-1 transition has-[a:hover]:ring-primary has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring sm:px-5 sm:py-4",
        highlight ? "bg-highlight-soft text-accent-foreground ring-primary" : "bg-card ring-border",
      )}
    >
      <dt className={cn("text-xs sm:text-sm", highlight ? "" : "text-muted-foreground")}>
        {href ? (
          <Link href={href} className="outline-none after:absolute after:inset-0 after:content-['']">
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className="font-heading text-2xl font-bold sm:text-3xl">
        {value}
      </dd>
    </div>
  );
}
