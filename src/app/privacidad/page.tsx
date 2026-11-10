import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Fragment, type ReactNode } from "react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LanguageToggle } from "@/components/landing/LanguageToggle";
import { Logo } from "@/components/Logo";
import { CONTACT_EMAIL, GOOGLE_PERMISSIONS_URL } from "@/lib/contact";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy.meta");
  return { title: t("title"), description: t("description") };
}

type Section = { title: string; paragraphs: string[] };

const LINK = "font-semibold text-highlight underline underline-offset-4";

/**
 * The privacy policy (LAND-5): public, signed in or not, linked from the home
 * page's footer and from Google's sign-in screen. Teal nórdico, like the home
 * page (LAND-3).
 */
export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const tApp = await getTranslations("app");
  const sections = t.raw("sections") as Section[];

  // The texts mark where the links go; the links themselves live here.
  const links: Record<string, ReactNode> = {
    email: (
      <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
        {CONTACT_EMAIL}
      </a>
    ),
    google: (
      <a href={GOOGLE_PERMISSIONS_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
        {t("google")}
      </a>
    ),
  };
  const withLinks = (text: string) =>
    text.split(/(\{email\}|\{google\})/).map((part, i) => <Fragment key={i}>{links[part.slice(1, -1)] ?? part}</Fragment>);

  return (
    <div data-palette="teal" className="flex flex-1 flex-col bg-background text-[17px] leading-[1.6] text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-6 py-3.5">
          <Link href="/" aria-label={tApp("name")} className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <Logo name={tApp("name")} />
          </Link>
          <LanguageToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] grow px-6 py-14">
        <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold text-highlight hover:underline">
          <ArrowLeft aria-hidden className="size-4" />
          {t("back")}
        </Link>
        <h1 className="mt-6 font-heading text-[clamp(36px,5vw,48px)] leading-[1.05] font-bold tracking-[-1px]">{t("title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("updated")}</p>
        <p className="mt-8 text-muted-foreground">{t("intro")}</p>

        {sections.map((s) => (
          <section key={s.title} className="mt-10">
            <h2 className="font-heading text-2xl leading-tight font-bold">{s.title}</h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="mt-3">
                {withLinks(p)}
              </p>
            ))}
          </section>
        ))}
      </main>

      <LandingFooter />
    </div>
  );
}
