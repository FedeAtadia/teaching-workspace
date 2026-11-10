"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "./LanguageToggle";

const SECTIONS = [
  { href: "#como", key: "how" },
  { href: "#funciones", key: "features" },
  { href: "#datos", key: "data" },
  { href: "#preguntas", key: "faq" },
] as const;

const PRIMARY =
  "inline-flex items-center justify-center gap-2.5 rounded-[14px] bg-primary font-bold text-primary-foreground transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

/**
 * The home page's top bar. On a computer: the logo, the section links, the
 * language switch and "Ingresar". On a phone only the logo shows, and the rest
 * is in a menu that stays closed until it is opened.
 */
export function LandingNav({ name }: { name: string }) {
  const t = useTranslations("landing");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] items-center gap-6 px-6 py-3.5">
        <a href="#top" aria-label={t("nav.home")} className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <Logo name={name} />
        </a>
        <nav aria-label={t("nav.sections")} className="hidden grow flex-wrap gap-x-5 gap-y-1 text-[15px] font-medium md:flex">
          {SECTIONS.map((s) => (
            <a key={s.key} href={s.href} className="text-muted-foreground transition hover:text-foreground">
              {t(`nav.${s.key}`)}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2.5 md:flex">
          <LanguageToggle />
          <GoogleSignInButton label={t("nav.signIn")} icon="none" className={`${PRIMARY} h-10 px-4 text-[15px]`} />
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="landing-menu"
          aria-label={t(open ? "nav.closeMenu" : "nav.openMenu")}
          className="ml-auto flex size-11 items-center justify-center rounded-xl border border-border bg-card text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>
      {open && (
        <div id="landing-menu" className="flex flex-col gap-1 border-t border-border px-6 pt-1 pb-5 md:hidden">
          <nav aria-label={t("nav.sections")} className="flex flex-col">
            {SECTIONS.map((s) => (
              <a
                key={s.key}
                href={s.href}
                onClick={close}
                className="flex min-h-12 items-center border-b border-border font-semibold text-foreground"
              >
                {t(`nav.${s.key}`)}
              </a>
            ))}
          </nav>
          <div className="flex min-h-13 items-center justify-between gap-3">
            <span className="text-[15px] text-muted-foreground">{t("nav.language")}</span>
            <LanguageToggle large />
          </div>
          <GoogleSignInButton label={t("hero.signIn")} icon="tile" className={`${PRIMARY} mt-2 h-13 text-[17px]`} />
        </div>
      )}
    </header>
  );
}
