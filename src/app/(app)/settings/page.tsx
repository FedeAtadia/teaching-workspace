import { getLocale, getTranslations } from "next-intl/server";
import { FormDialog } from "@/components/forms/FormDialog";
import { LanguageSelect } from "@/components/LanguageSelect";
import { getDb } from "@/db";
import { listSchools } from "@/db/queries/classes";
import { requireTeacherId } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { renameSchoolAction } from "./actions";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const schools = isSupabaseConfigured() ? await listSchools(getDb(), await requireTeacherId()) : [];

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <div className="grid max-w-xl gap-10">
        <label className="flex max-w-xs flex-col gap-2 text-sm">
          {t("language")}
          <LanguageSelect current={await getLocale()} />
        </label>

        <section>
          <h2 className="mb-1 text-lg font-semibold">{t("schools.title")}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{t("schools.intro")}</p>
          {schools.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("schools.empty")}</p>
          ) : (
            <ul className="grid gap-2">
              {schools.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{t("schools.courses", { count: s.courses })}</p>
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
