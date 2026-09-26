import { getTranslations } from "next-intl/server";

export default async function StudentsPage() {
  const t = await getTranslations("students");
  return <h1 className="text-2xl font-semibold">{t("title")}</h1>;
}
