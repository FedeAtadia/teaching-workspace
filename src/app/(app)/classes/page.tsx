import { getTranslations } from "next-intl/server";

export default async function ClassesPage() {
  const t = await getTranslations("classes");
  return <h1 className="text-2xl font-semibold">{t("title")}</h1>;
}
