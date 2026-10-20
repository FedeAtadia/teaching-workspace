import { CalendarDays } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FormDialog } from "@/components/forms/FormDialog";
import { LanguageSelect } from "@/components/LanguageSelect";
import { MinAttendanceForm } from "@/components/settings/MinAttendanceForm";
import { ThemeSelect } from "@/components/ThemeSelect";
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
    <>
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>
      <div className="grid max-w-xl gap-10">
        <section className="grid gap-6 rounded-2xl bg-card p-5 ring-1 ring-border">
          <div className="grid gap-2">
            <h2 className="text-sm font-bold">{t("theme.title")}</h2>
            <ThemeSelect
              current={theme}
              labels={{ system: t("theme.system"), light: t("theme.light"), dark: t("theme.dark") }}
            />
          </div>
          <label className="flex max-w-xs flex-col gap-2 text-sm font-bold">
            {t("language")}
            <LanguageSelect current={await getLocale()} />
          </label>
        </section>

        {minAttendance !== null && (
          <section className="grid gap-3 rounded-2xl bg-card p-5 ring-1 ring-border">
            <h2 className="text-sm font-bold">{t("attendance.title")}</h2>
            <MinAttendanceForm current={minAttendance} />
          </section>
        )}

        <section>
          <h2 className="mb-1 text-lg font-semibold">{t("schools.title")}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{t("schools.intro")}</p>
          {schools.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("schools.empty")}</p>
          ) : (
            <ul className="grid gap-2">
              {schools.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{t("schools.courses", { count: s.courses })}</p>
                    {/* CAL-1: one calendar per school year the school has courses in. */}
                    {s.years.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {s.years.map((year) => (
                          <Link
                            key={year}
                            href={`/settings/schools/${s.id}/calendar/${year}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <CalendarDays className="size-3.5" aria-hidden />
                            {t("schools.calendar", { year })}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  <FormDialog
                    triggerLabel={t("schools.rename")}
                    title={t("schools.renameTitle", { name: s.name })}
                    action={renameSchoolAction}
                    hidden={{ schoolId: s.id }}
                    formErrors={{ duplicate: t("schools.duplicate"), notFound: t("schools.notFound") }}
                    fields={[
                      { kind: "text", name: "name", label: t("schools.name"), maxLength: 120, defaultValue: s.name },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
