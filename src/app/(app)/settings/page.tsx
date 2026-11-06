import {
  CalendarDays,
  ClipboardCheck,
  Landmark,
  Languages,
  type LucideIcon,
  Palette,
  School,
} from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { FormDialog } from "@/components/forms/FormDialog";
import { LanguageSelect } from "@/components/LanguageSelect";
import { PageHeader } from "@/components/PageHeader";
import { MinAttendanceForm } from "@/components/settings/MinAttendanceForm";
import { ThemeSelect } from "@/components/ThemeSelect";
import { Badge } from "@/components/ui/badge";
import { resolveTheme, THEME_COOKIE } from "@/lib/theme";
import { getDb } from "@/db";
import { listSchools } from "@/db/queries/classes";
import { getMinAttendance } from "@/db/queries/settings";
import { requireTeacherId } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { renameSchoolAction } from "./actions";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);
  const teacherId = isSupabaseConfigured() ? await requireTeacherId() : null;
  const [schools, minAttendance] = teacherId
    ? await Promise.all([listSchools(getDb(), teacherId), getMinAttendance(getDb(), teacherId)])
    : [[], null];

  return (
    <PageHeader title={t("title")}>
      <div className="grid max-w-4xl gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsCard icon={Languages} title={t("language")}>
            <label className="grid gap-2 text-sm text-muted-foreground">
              {t("languageHint")}
              <LanguageSelect current={await getLocale()} />
            </label>
          </SettingsCard>
          <SettingsCard icon={Palette} title={t("theme.title")}>
            <p className="text-sm text-muted-foreground">{t("theme.hint")}</p>
            <ThemeSelect
              current={theme}
              labels={{ system: t("theme.system"), light: t("theme.light"), dark: t("theme.dark") }}
            />
          </SettingsCard>
        </div>

        {minAttendance !== null && (
          <SettingsCard icon={ClipboardCheck} title={t("attendance.title")}>
            <MinAttendanceForm current={minAttendance} />
          </SettingsCard>
        )}

        <SettingsCard icon={Landmark} title={t("schools.title")}>
          <p className="text-sm text-muted-foreground">{t("schools.intro")}</p>
          {schools.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("schools.empty")}</p>
          ) : (
            <ul className="grid gap-2">
              {schools.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 rounded-xl bg-muted/60 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-highlight ring-1 ring-border"
                      aria-hidden
                    >
                      <School className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-0 font-heading text-lg leading-tight font-bold">{s.name}</p>
                      <Badge tone="accent">{t("schools.courses", { count: s.courses })}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FormDialog
                      trigger="edit"
                      triggerLabel={t("schools.rename")}
                      title={t("schools.renameTitle", { name: s.name })}
                      action={renameSchoolAction}
                      hidden={{ schoolId: s.id }}
                      formErrors={{ duplicate: t("schools.duplicate"), notFound: t("schools.notFound") }}
                      fields={[
                        { kind: "text", name: "name", label: t("schools.name"), maxLength: 120, defaultValue: s.name },
                      ]}
                    />
                    {/* CAL-1: one calendar per school year the school has courses in. */}
                    {s.years.map((year) => (
                      <Link
                        key={year}
                        href={`/settings/schools/${s.id}/calendar/${year}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-highlight transition-colors hover:bg-highlight-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <CalendarDays className="size-4" aria-hidden />
                        {t("schools.calendar", { year })}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SettingsCard>
      </div>
    </PageHeader>
  );
}

/** One group of settings: a card with an icon and a title. */
function SettingsCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-4 rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
      <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
        <Icon className="size-5 text-highlight" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}
