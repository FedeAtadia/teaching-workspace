import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm opacity-70">{t("empty")}</p>
    </>
  );
}
