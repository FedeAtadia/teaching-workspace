import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSelect } from "@/components/LanguageSelect";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <label className="flex max-w-xs flex-col gap-2 text-sm">
        {t("language")}
        <LanguageSelect current={await getLocale()} />
      </label>
    </>
  );
}
