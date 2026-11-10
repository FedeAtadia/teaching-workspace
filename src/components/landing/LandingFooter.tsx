import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";

/** The public pages' footer: the logo, who made it, the privacy policy (LAND-5) and the year. */
export async function LandingFooter() {
  const t = await getTranslations("landing.footer");
  const tApp = await getTranslations("app");
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-7 text-sm text-muted-foreground">
        <span className="text-foreground">
          <Logo name={tApp("name")} />
        </span>
        <span>{t("madeBy")}</span>
        <span className="flex items-center gap-[18px]">
          <Link href="/privacidad" className="underline-offset-4 hover:text-foreground hover:underline">
            {t("privacy")}
          </Link>
          <span>© {new Date().getFullYear()}</span>
        </span>
      </div>
    </footer>
  );
}
