import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { SOCIAL } from "@/lib/contact";

const ICON_LINK =
  "lp-lift flex size-10 items-center justify-center rounded-xl border border-border text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * The public pages' footer: the logo, who made it, the privacy policy
 * (LAND-5), Annora's social media (LAND-6) and the year.
 */
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
          <nav aria-label={t("social")} className="flex gap-2">
            <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer" aria-label={t("instagram")} className={ICON_LINK}>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
            <a href={SOCIAL.x} target="_blank" rel="noopener noreferrer" aria-label={t("x")} className={ICON_LINK}>
              <svg viewBox="0 0 24 24" className="size-[17px]" fill="currentColor" aria-hidden>
                <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.24-8.28L2.96 2h6.4l4.42 5.84L18.9 2Zm-1.1 18.13h1.73L8.24 3.77H6.39l11.41 16.36Z" />
              </svg>
            </a>
          </nav>
          <span>© {new Date().getFullYear()}</span>
        </span>
      </div>
    </footer>
  );
}
