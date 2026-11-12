import { getLocale, getTranslations } from "next-intl/server";
import { formatGrade } from "@/lib/format";
import type { FollowUpReason } from "@/lib/followUp";

/** FOLLOW-1: a class's reasons in words: "asistencia 68 %, promedio 5,50". */
export async function FollowUpReasons({ reasons }: { reasons: FollowUpReason[] }) {
  const t = await getTranslations("followUp.reasons");
  const locale = await getLocale();
  const text = (r: FollowUpReason) => {
    switch (r.kind) {
      case "attendance":
        return t("attendance", { rate: r.rate });
      case "average":
        return t("average", { average: formatGrade(r.average, locale) });
      case "missing":
        return t("missing", { count: r.count });
    }
  };
  return <>{reasons.map(text).join(", ")}</>;
}
